import { Injectable, Logger } from '@nestjs/common';
import { guildEvents, GuildLeaderChangedPayload } from '../guild/guild.events';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from './user.entity';
import { LevelsService } from '../levels/levels.service';
import { UserStatsService } from '../user-stats/user-stats.service';
import { UserPowerService } from '../user-power/user-power.service';
import { EventsService } from '../events/events.module';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly levelsService: LevelsService,
    private readonly userStatsService: UserStatsService,
    private readonly userPowerService: UserPowerService,
    private readonly dataSource: DataSource,
    private readonly eventsService: EventsService,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: number): Promise<User | null> {
    // Include characterClass relation so API consumers see user's current class
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['characterClass'],
    });
    if (!user) return null;

    // Ensure there's an authoritative user_power row. If missing, compute and persist it.
    try {
      // userPowerService.computeAndSaveForUser will upsert and return the power.
      const power = await this.userPowerService.computeAndSaveForUser(user.id);
      // Attach non-persistent field for convenience when the API returns the user object
      // so frontend can read `combatPower` directly from the user payload.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      user.combatPower = power;
    } catch (err: unknown) {
      // Don't fail the whole request if compute fails; log and continue.
      this.logger.error('Failed to compute user_power on read', err as any);
    }

    return user;
  }

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ username });
  }

  /**
   * Search users by username (partial, case-insensitive) for admin lookups.
   */
  async searchByUsername(q: string): Promise<User[]> {
    if (!q || q.trim().length === 0) return [];
    const like = `%${q.trim().toLowerCase()}%`;
    return this.usersRepository
      .createQueryBuilder('u')
      .where('LOWER(u.username) LIKE :like', { like })
      .orderBy('u.username', 'ASC')
      .limit(30)
      .getMany();
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.usersRepository.create(user);
    return this.usersRepository.save(newUser);
  }

  async update(id: number, user: Partial<User>): Promise<User | null> {
    await this.usersRepository.update(id, user);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.usersRepository.delete(id);
  }

  /**
   * Remove a user and related user-scoped data in a transaction.
   * This attempts to delete rows from tables that reference userId to
   * avoid orphaned records when DB-level ON DELETE CASCADE is not set.
   */
  async removeAccount(id: number): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Order deletes to avoid FK constraint violations where possible.
      // Delete mailbox, market offers, market listings, purchase_history, escrow
      await queryRunner.manager.delete('mailbox', { userId: id });
      await queryRunner.manager.delete('market_offer', { buyerId: id });
      await queryRunner.manager.delete('market_listing', { sellerId: id });
      await queryRunner.manager.delete('purchase_history', { buyerId: id });
      await queryRunner.manager.delete('purchase_history', { sellerId: id });
      await queryRunner.manager.delete('escrow', { buyerId: id });

      // User items, upgrade logs
      await queryRunner.manager.delete('upgrade_log', { userId: id });
      await queryRunner.manager.delete('user_item', { userId: id });

      // User quests, quest tracking
      await queryRunner.manager.delete('quest_combat_tracking', { userId: id });
      await queryRunner.manager.delete('user_quests', { userId: id });

      // User stats, stamina, power
      await queryRunner.manager.delete('user_stat', { userId: id });
      await queryRunner.manager.delete('user_stamina', { userId: id });
      await queryRunner.manager.delete('user_power', { userId: id });

      // Guild membership and related references
      // If user is a leader of any guilds, attempt to transfer leadership
      const leaderGuilds: Array<{ id: number }> =
        await queryRunner.manager.query(
          `SELECT id FROM guilds WHERE leaderId = $1`,
          [id],
        );
      const leaderChanges: GuildLeaderChangedPayload[] = [];
      for (const g of leaderGuilds) {
        // Try to find a deputy, then elder, then oldest member to promote
        type UserRow = { user_id: number };
        const deputy: UserRow[] = await queryRunner.manager.query(
          `SELECT user_id FROM guild_members WHERE guild_id = $1 AND role = 'DEPUTY' ORDER BY joined_at ASC LIMIT 1`,
          [g.id],
        );
        const elder: UserRow[] = await queryRunner.manager.query(
          `SELECT user_id FROM guild_members WHERE guild_id = $1 AND role = 'ELDER' ORDER BY joined_at ASC LIMIT 1`,
          [g.id],
        );
        const member: UserRow[] = await queryRunner.manager.query(
          `SELECT user_id FROM guild_members WHERE guild_id = $1 AND role = 'MEMBER' ORDER BY joined_at ASC LIMIT 1`,
          [g.id],
        );

        const promoteTo =
          (deputy && deputy.length > 0 && deputy[0].user_id) ||
          (elder && elder.length > 0 && elder[0].user_id) ||
          (member && member.length > 0 && member[0].user_id) ||
          null;
        if (promoteTo) {
          // Update guild leaderId and set new member role to LEADER
          await queryRunner.manager.update(
            'guilds',
            { id: g.id },
            { leaderId: promoteTo },
          );
          await queryRunner.manager.update(
            'guild_members',
            { guildId: g.id, userId: promoteTo },
            { role: 'LEADER' },
          );
          leaderChanges.push({
            guildId: g.id,
            oldLeaderId: id,
            newLeaderId: promoteTo,
            timestamp: new Date().toISOString(),
          });
        } else {
          // No members left, set leaderId to null
          await queryRunner.manager.update(
            'guilds',
            { id: g.id },
            { leaderId: null },
          );
          leaderChanges.push({
            guildId: g.id,
            oldLeaderId: id,
            newLeaderId: null,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Now delete guild membership rows for this user
      await queryRunner.manager.delete('guild_members', { userId: id });

      // Chat messages, combat logs, pvp players, room_player
      await queryRunner.manager.delete('chat_messages', { userId: id });
      await queryRunner.manager.delete('boss_combat_log', { userId: id });
      await queryRunner.manager.delete('pvp_players', { userId: id });
      await queryRunner.manager.delete('room_player', { playerId: id });

      // Finally remove the user row
      await queryRunner.manager.delete('user', { id });

      await queryRunner.commitTransaction();

      // Emit guild leader change events after successful commit so listeners
      // (e.g. ChatGateway) will broadcast only persisted changes.
      try {
        for (const payload of leaderChanges) {
          guildEvents.emit('guildLeaderChanged', payload);
        }
      } catch (emitErr) {
        // Non-fatal: log and continue. We don't want notification failure to
        // roll back the already committed DB transaction.
        this.logger.error(
          'Failed to emit guild leader change events: ' +
            (emitErr as Error).message,
        );
      }
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to remove account: ' + (err as Error).message);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async banUser(id: number): Promise<User> {
    await this.usersRepository.update(id, { isBanned: true });
    const user = await this.findOne(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async unbanUser(id: number): Promise<User> {
    await this.usersRepository.update(id, { isBanned: false });
    const user = await this.findOne(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async promoteUser(id: number, type: 'admin' | 'donor'): Promise<User> {
    const updateData = type === 'admin' ? { isAdmin: true } : { isDonor: true };
    await this.usersRepository.update(id, updateData);
    const user = await this.findOne(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async demoteUser(id: number, type: 'admin' | 'donor'): Promise<User> {
    const updateData =
      type === 'admin' ? { isAdmin: false } : { isDonor: false };
    await this.usersRepository.update(id, updateData);
    const user = await this.findOne(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async levelUpUser(id: number): Promise<User> {
    const user = await this.findOne(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Lấy thông tin level tiếp theo
    const nextLevel = await this.levelsService.getNextLevel(user.level);
    if (!nextLevel) {
      throw new Error('Max level reached');
    }

    // Kiểm tra có đủ kinh nghiệm không
    if (user.experience < nextLevel.experienceRequired) {
      throw new Error('Not enough experience to level up');
    }

    // Tăng level và reset experience
    user.level += 1;
    user.experience = 0; // Reset experience về 0

    // Lấy stats của level mới
    const levelStats = await this.levelsService.getLevelStats(user.level);
    if (levelStats) {
      // Áp dụng stats level up (bao gồm hồi đầy HP)
      await this.userStatsService.applyLevelUpStats(id, levelStats);
    } else {
      // Diagnostic: log when level rows are missing so we can detect seed/migration issues
      try {
        console.warn(
          `Level stats missing for level=${user.level} while leveling user=${id}. This may explain why level buffs (HP/attack/defense) are not applied.`,
        );
      } catch {
        // ignore
      }
    }

    // Lưu user
    await this.usersRepository.save(user);

    // Ensure derived stats are recomputed authoritatively after level up and heal the player.
    try {
      await this.userStatsService.recomputeAndPersistForUser(user.id, {
        fillCurrentHp: true,
      });
    } catch (e) {
      this.logger.warn(
        'Failed to recompute stats after level up: ' +
          ((e as Error)?.message || e),
      );
    }

    // Evaluate possible awakenings/promotions after level up
    try {
      // Emit an event so advancement logic can be handled by a different module
      try {
        this.eventsService.emit('user.levelUp', {
          userId: user.id,
          oldLevel: user.level - 1,
          newLevel: user.level,
        });
      } catch (err) {
        this.logger.error(
          'Failed to emit levelUp event: ' + (err as Error).message,
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to evaluate advancement after level up: ' +
          (err as Error).message,
      );
    }

    return user;
  }
}
