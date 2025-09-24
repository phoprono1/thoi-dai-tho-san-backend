import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CharacterClass, ClassTier } from './character-class.entity';
import { CharacterClassAdvancement } from './character-class-advancement.entity';
import { CharacterClassHistory } from './character-class-history.entity';
import { PendingAdvancement } from './pending-advancement.entity';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import { CharacterClassService } from './character-class.service';
import { UserPowerService } from '../user-power/user-power.service';
import { MailboxGateway } from '../mailbox/mailbox.gateway';
import { EventsService } from '../events/events.module';
import { UserStatsService } from '../user-stats/user-stats.service';

@Injectable()
export class AdvancementService implements OnModuleInit {
  constructor(
    @InjectRepository(CharacterClass)
    private characterClassRepository: Repository<CharacterClass>,
    @InjectRepository(CharacterClassAdvancement)
    private mappingRepository: Repository<CharacterClassAdvancement>,
    @InjectRepository(CharacterClassHistory)
    private historyRepository: Repository<CharacterClassHistory>,
    @InjectRepository(PendingAdvancement)
    private pendingRepository: Repository<PendingAdvancement>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserStat)
    private userStatRepository: Repository<UserStat>,
    private dataSource: DataSource,
    private characterClassService?: CharacterClassService,
    private mailboxGateway?: MailboxGateway,
    private eventsService?: EventsService,
    private userPowerService?: UserPowerService,
    private userStatsService?: UserStatsService,
  ) {}

  onModuleInit() {
    // subscribe to user.levelUp events if eventsService is available
    if (this.eventsService && typeof this.eventsService.on === 'function') {
      this.eventsService.on(
        'user.levelUp',
        (payload: { userId: number; oldLevel: number; newLevel: number }) => {
          // fire-and-forget; ensure any Promise is not returned to EventEmitter
          void (async () => {
            try {
              await this.evaluateLevelUp(
                payload.userId,
                payload.oldLevel,
                payload.newLevel,
              );
            } catch (err) {
              console.error('Error processing levelUp event', err);
            }
          })();
        },
      );
    }
  }

  // Evaluate level up and apply awakening at level 10 randomly for tier1 classes.
  // For tier2+ promotions (level thresholds 25+), evaluate requirements and create pending
  // advancement records when player choice is required.
  public async evaluateLevelUp(
    userId: number,
    oldLevel: number,
    newLevel: number,
  ): Promise<{ applied: boolean; newClassId?: number }> {
    const crossed10 = oldLevel < 10 && newLevel >= 10;

    // Load user and current class
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['characterClass'],
    });

    if (!user) throw new NotFoundException('User not found');
    const currentClass = user.characterClass;
    if (!currentClass) return { applied: false };

    // Find mappings for this class and filter by level requirement
    const mappings = await this.mappingRepository.find({
      where: { fromClassId: currentClass.id },
    });
    const eligible = mappings.filter((m) => m.levelRequired <= newLevel);
    if (!eligible || eligible.length === 0) return { applied: false };

    // Awakening candidates (tier1 at lv10)
    const awakeningCandidates = eligible.filter((m) => m.isAwakening);

    if (
      currentClass.tier === ClassTier.BASIC &&
      crossed10 &&
      awakeningCandidates.length > 0
    ) {
      // Weighted random selection with safe fallback if total weight is zero
      const totalWeight = awakeningCandidates.reduce(
        (s, m) => s + (m.weight || 0),
        0,
      );

      let chosen: CharacterClassAdvancement;
      if (totalWeight <= 0) {
        // fallback: uniform random pick among candidates
        const idx = Math.floor(Math.random() * awakeningCandidates.length);
        chosen = awakeningCandidates[idx];
      } else {
        const rnd = Math.random() * totalWeight;
        let acc = 0;
        chosen = awakeningCandidates[0];
        for (const m of awakeningCandidates) {
          acc += m.weight || 0;
          if (rnd <= acc) {
            chosen = m;
            break;
          }
        }
      }

      // Apply chosen mapping transactionally
      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        const dbUser = await qr.manager.findOne(User, {
          where: { id: userId },
          relations: ['characterClass'],
          lock: { mode: 'pessimistic_write' },
        });

        if (!dbUser) throw new NotFoundException('User not found');

        const prevClass = dbUser.characterClass;
        const targetClass = await qr.manager.findOne(CharacterClass, {
          where: { id: chosen.toClassId },
        });
        if (!targetClass) throw new NotFoundException('Target class not found');

        dbUser.characterClass = targetClass;
        await qr.manager.save(dbUser);

        // Update stats deltas
        const userStats = await qr.manager.findOne(UserStat, {
          where: { userId },
        });
        // Apply statBonuses delta for awakening (similar to promotion)
        if (userStats) {
          const oldS = prevClass?.statBonuses || {};
          const newS = targetClass.statBonuses || {};
          const delta = {
            strength: (newS.strength || 0) - (oldS.strength || 0),
            intelligence: (newS.intelligence || 0) - (oldS.intelligence || 0),
            dexterity: (newS.dexterity || 0) - (oldS.dexterity || 0),
            vitality: (newS.vitality || 0) - (oldS.vitality || 0),
            luck: (newS.luck || 0) - (oldS.luck || 0),
          };

          userStats.strength += delta.strength;
          userStats.intelligence += delta.intelligence;
          userStats.dexterity += delta.dexterity;
          userStats.vitality += delta.vitality;
          userStats.luck += delta.luck;

          // Derived stats are now calculated on-demand, no need to set them manually
          await qr.manager.save(userStats);
        }

        const history = qr.manager.create(CharacterClassHistory, {
          characterId: userId,
          previousClassId: prevClass?.id || null,
          newClassId: targetClass.id,
          reason: 'awakening',
          triggeredByUserId: null,
        });

        await qr.manager.save(history);
        await qr.commitTransaction();

        // Note: Equip doesn't change on advancement, so no need to recompute stats.
        // Update direct above is sufficient.
        // Best-effort: recompute user_power only.
        try {
          if (this.userPowerService) {
            await this.userPowerService.computeAndSaveForUser(userId);
          }
        } catch (e) {
          console.warn('Failed to recompute power after advancement', e);
        }

        // TODO: emit socket event to user to notify class change
        return { applied: true, newClassId: targetClass.id };
      } catch (err) {
        await qr.rollbackTransaction();
        throw err;
      } finally {
        await qr.release();
      }
    }

    // Promotions (tier2+) - include mappings that are not awakenings or explicit high-level promotions
    const promotions = eligible.filter(
      (m) => !m.isAwakening || m.levelRequired >= 25,
    );
    if (!promotions || promotions.length === 0) return { applied: false };

    // Build options list and run server-side requirement checks so we persist only
    // options the user can actually accept (or include missingRequirements metadata).
    const options: Array<{
      mappingId: number;
      toClassId: number;
      description?: string;
      missingRequirements?: Record<string, unknown>;
    }> = [];

    for (const m of promotions) {
      let missing: Record<string, unknown> | null = null;
      let canAdvance = true;
      try {
        if (this.characterClassService) {
          const res =
            await this.characterClassService.checkAdvancementRequirements(
              userId,
              m.toClassId,
            );
          canAdvance = res.canAdvance;
          missing = res.missingRequirements;
        }
      } catch (e) {
        // if validator throws, treat as not advanceable
        canAdvance = false;
        missing = { error: (e as Error).message };
      }

      // include option but attach missingRequirements so UI can show details; we will
      // filter later when creating pending records depending on desired UX. Here we
      // include only options that are advanceable.
      if (canAdvance) {
        options.push({
          mappingId: m.id,
          toClassId: m.toClassId,
          description: undefined,
          missingRequirements: missing || {},
        });
      }
    }

    if (options.length === 0) return { applied: false };

    const requiresChoice = promotions.some((m) => m.allowPlayerChoice === true);
    if (requiresChoice) {
      // If no options are actually advanceable after server-side filtering, skip
      if (options.length === 0) return { applied: false };

      const pending = this.pendingRepository.create({
        userId,
        options,
        status: 'available',
      });
      const saved = await this.pendingRepository.save(pending);
      // Emit socket event to user's room to notify about available advancement
      try {
        if (
          this.mailboxGateway &&
          typeof this.mailboxGateway.emitAdvancementPending === 'function'
        ) {
          this.mailboxGateway.emitAdvancementPending(userId, saved);
        } else if (
          this.mailboxGateway &&
          typeof this.mailboxGateway.emitMailReceived === 'function'
        ) {
          // fallback: notify via mailReceived with the pending id so clients can fetch
          this.mailboxGateway.emitMailReceived(
            userId,
            saved.id as unknown as number,
          );
        }
      } catch (err) {
        // Log but do not fail the flow if emit fails
        console.error('Failed to emit advancement pending notification', err);
      }
      return { applied: false };
    }

    // Auto-pick by weight among promotions with safe fallback when total weight is zero
    const totalW = promotions.reduce((s, m) => s + (m.weight || 0), 0);
    let pick: CharacterClassAdvancement;
    if (totalW <= 0) {
      // fallback: uniform random among promotions
      const idx = Math.floor(Math.random() * promotions.length);
      pick = promotions[idx];
    } else {
      const r = Math.random() * totalW;
      let acc2 = 0;
      pick = promotions[0];
      for (const m of promotions) {
        acc2 += m.weight || 0;
        if (r <= acc2) {
          pick = m;
          break;
        }
      }
    }

    // Apply picked promotion transactionally
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const dbUser = await runner.manager.findOne(User, {
        where: { id: userId },
        relations: ['characterClass'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!dbUser) throw new NotFoundException('User not found');

      const prevClass = dbUser.characterClass;
      const tClass = await runner.manager.findOne(CharacterClass, {
        where: { id: pick.toClassId },
      });
      if (!tClass) throw new NotFoundException('Target class not found');

      dbUser.characterClass = tClass;
      await runner.manager.save(dbUser);

      const uStats = await runner.manager.findOne(UserStat, {
        where: { userId },
      });
      if (uStats) {
        const oldS = prevClass?.statBonuses || {};
        const newS = tClass.statBonuses || {};
        const delta = {
          strength: (newS.strength || 0) - (oldS.strength || 0),
          intelligence: (newS.intelligence || 0) - (oldS.intelligence || 0),
          dexterity: (newS.dexterity || 0) - (oldS.dexterity || 0),
          vitality: (newS.vitality || 0) - (oldS.vitality || 0),
          luck: (newS.luck || 0) - (oldS.luck || 0),
        };

        uStats.strength += delta.strength;
        uStats.intelligence += delta.intelligence;
        uStats.dexterity += delta.dexterity;
        uStats.vitality += delta.vitality;
        uStats.luck += delta.luck;

        // Derived stats are now calculated on-demand, no need to set them manually
        await runner.manager.save(uStats);
      }

      const hist = runner.manager.create(CharacterClassHistory, {
        characterId: userId,
        previousClassId: prevClass?.id || null,
        newClassId: tClass.id,
        reason: 'promotion',
        triggeredByUserId: null,
      });
      await runner.manager.save(hist);

      await runner.commitTransaction();
      return { applied: true, newClassId: tClass.id };
    } catch (err) {
      await runner.rollbackTransaction();
      throw err;
    } finally {
      await runner.release();
    }
  }

  // List pending advancements for a user
  public async listPendingForUser(userId: number) {
    return this.pendingRepository.find({
      where: { userId, status: 'available' },
    });
  }

  // Accept a pending advancement option and apply it
  public async acceptPending(
    userId: number,
    pendingId: number,
    mappingId: number,
  ) {
    const pending = await this.pendingRepository.findOne({
      where: { id: pendingId, userId },
    });
    if (!pending) throw new NotFoundException('Pending advancement not found');
    if (pending.status !== 'available')
      throw new Error('Pending advancement not available');

    const option = pending.options.find((o) => o.mappingId === mappingId);
    if (!option) throw new NotFoundException('Option not found');

    // Apply chosen mapping
    const mapping = await this.mappingRepository.findOne({
      where: { id: mappingId },
    });
    if (!mapping) throw new NotFoundException('Mapping not found');

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const dbUser = await runner.manager.findOne(User, {
        where: { id: userId },
        relations: ['characterClass'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!dbUser) throw new NotFoundException('User not found');
      const prevClass = dbUser.characterClass;
      const tClass = await runner.manager.findOne(CharacterClass, {
        where: { id: mapping.toClassId },
      });
      if (!tClass) throw new NotFoundException('Target class not found');

      dbUser.characterClass = tClass;
      await runner.manager.save(dbUser);

      const uStats = await runner.manager.findOne(UserStat, {
        where: { userId },
      });
      if (uStats) {
        const oldS = prevClass?.statBonuses || {};
        const newS = tClass.statBonuses || {};
        const delta = {
          strength: (newS.strength || 0) - (oldS.strength || 0),
          intelligence: (newS.intelligence || 0) - (oldS.intelligence || 0),
          dexterity: (newS.dexterity || 0) - (oldS.dexterity || 0),
          vitality: (newS.vitality || 0) - (oldS.vitality || 0),
          luck: (newS.luck || 0) - (oldS.luck || 0),
        };

        uStats.strength += delta.strength;
        uStats.intelligence += delta.intelligence;
        uStats.dexterity += delta.dexterity;
        uStats.vitality += delta.vitality;
        uStats.luck += delta.luck;

        // Derived stats are now calculated on-demand, no need to set them manually
        await runner.manager.save(uStats);
      }

      const hist = runner.manager.create(CharacterClassHistory, {
        characterId: userId,
        previousClassId: prevClass?.id || null,
        newClassId: tClass.id,
        reason: 'promotion',
        triggeredByUserId: userId,
      });
      await runner.manager.save(hist);

      pending.status = 'accepted';
      await this.pendingRepository.save(pending);

      await runner.commitTransaction();

      // Emit socket event to notify user of applied advancement
      try {
        if (
          this.mailboxGateway &&
          typeof this.mailboxGateway.emitAdvancementApplied === 'function'
        ) {
          this.mailboxGateway.emitAdvancementApplied(userId, {
            pendingId,
            newClassId: tClass.id,
          });
        }
      } catch (err) {
        console.error('Failed to emit advancement applied notification', err);
      }

      return { applied: true, newClassId: tClass.id };
    } catch (err) {
      await runner.rollbackTransaction();
      throw err;
    } finally {
      await runner.release();
    }
  }
}
