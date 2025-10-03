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
      this.logger.log(`Starting account removal for user ${id}`);
      await queryRunner.manager.delete('mailbox', { userId: id });
      this.logger.log('Deleted mailbox');
      // Note: market_offer, market_listing, purchase_history, escrow tables may not exist in current schema
      // await queryRunner.manager.delete('market_offer', { buyerId: id });
      // await queryRunner.manager.delete('market_listing', { sellerId: id });
      // await queryRunner.manager.delete('purchase_history', { buyerId: id });
      // await queryRunner.manager.delete('purchase_history', { sellerId: id });
      // await queryRunner.manager.delete('escrow', { buyerId: id });
      this.logger.log('Skipped market and escrow data (tables may not exist)');

      // User items, upgrade logs
      await queryRunner.manager.delete('upgrade_log', { userId: id });
      await queryRunner.manager.delete('user_item', { userId: id });
      this.logger.log('Deleted user items and upgrade logs');

      // User quests, quest tracking
      await queryRunner.manager.delete('quest_combat_tracking', { userId: id });
      await queryRunner.manager.delete('user_quests', { userId: id });
      this.logger.log('Deleted user quests');

      // User stats, stamina, power
      await queryRunner.manager.delete('user_stat', { userId: id });
      await queryRunner.manager.delete('user_stamina', { userId: id });
      await queryRunner.manager.delete('user_power', { userId: id });
      this.logger.log('Deleted user stats');

      // Player skills and donors
      // await queryRunner.manager.delete('player_skills', { userId: id }); // Table may not exist
      await queryRunner.manager.delete('donors', { userId: id });
      this.logger.log('Deleted donors (skipped player_skills)');

      // Combat logs and results
      await queryRunner.manager.delete('combat_log', { userId: id });
      // For combat_result, we need to handle the userIds array
      const combatResults: Array<{ id: number }> =
        await queryRunner.manager.query(
          `SELECT id FROM combat_result WHERE EXISTS (SELECT 1 FROM json_array_elements_text("userIds"::json) AS elem WHERE elem::int = $1)`,
          [id],
        );
      for (const result of combatResults) {
        await queryRunner.manager.delete('combat_result', { id: result.id });
      }
      this.logger.log('Deleted combat logs and results');

      // World boss damage rankings and combat logs
      await queryRunner.manager.delete('boss_damage_ranking', { userId: id });
      await queryRunner.manager.delete('boss_combat_log', { userId: id });
      this.logger.log('Deleted boss data');

      // Guild membership and related references
      // If user is a leader of any guilds, attempt to transfer leadership
      const leaderGuilds: Array<{ id: number }> =
        await queryRunner.manager.query(
          `SELECT id FROM guild WHERE "leaderId" = $1`,
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
            'guild',
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
            'guild',
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
      this.logger.log('Handled guild leadership and membership');

      // Chat messages, pvp players, room_player
      await queryRunner.manager.delete('chat_messages', { userId: id });
      await queryRunner.manager.delete('pvp_players', { userId: id });
      await queryRunner.manager.delete('room_player', { playerId: id });
      this.logger.log('Deleted chat, pvp, and room data');

      // Finally remove the user row
      await queryRunner.manager.delete('user', { id });
      this.logger.log('Deleted user row');

      await queryRunner.commitTransaction();
      this.logger.log(`Successfully removed account for user ${id}`);

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
      this.logger.error(
        'Failed to remove account: ' +
          (err as Error).message +
          '\n' +
          (err as Error).stack,
      );
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

    const originalLevel = user.level;
    let totalAttributePointsToGrant = 0;

    // Loop to level up multiple times if exp allows
    // CUMULATIVE SYSTEM: experienceRequired = TOTAL exp needed from level 1
    while (true) {
      // Lấy thông tin level tiếp theo
      const nextLevel = await this.levelsService.getNextLevel(user.level);
      if (!nextLevel) {
        break; // Max level reached
      }

      // CUMULATIVE: Check if total exp >= threshold for next level
      // No subtraction needed - exp stays as total accumulated
      if (user.experience < nextLevel.experienceRequired) {
        break; // Not enough exp
      }

      // Tăng level (KHÔNG trừ experience - đây là cumulative system)
      user.level += 1;
      // Note: user.experience stays the same (total accumulated exp)

      // Accumulate attribute points from this level's reward
      totalAttributePointsToGrant += nextLevel.attributePointsReward || 0;

      // Lưu user trước để update level
      await this.usersRepository.save(user);

      // Stats are now computed on-demand from core attributes, no need to recompute
    }

    if (user.level === originalLevel) {
      throw new Error('Not enough experience to level up');
    }

    const levelsGained = user.level - originalLevel;

    // Grant accumulated attribute points from all levels gained
    if (totalAttributePointsToGrant > 0) {
      try {
        await this.userStatsService.addFreeAttributePoints(
          user.id,
          totalAttributePointsToGrant,
        );
        this.logger.log(
          `Granted ${totalAttributePointsToGrant} attribute points to user ${user.id} (leveled from ${originalLevel} to ${user.level})`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to grant attribute points on level up: ${(err as Error).message}`,
        );
      }
    }

    // Grant skill points (1 per level gained)
    if (levelsGained > 0) {
      try {
        await this.userStatsService.grantSkillPoints(user.id, levelsGained);
        this.logger.log(
          `Granted ${levelsGained} skill points to user ${user.id} (leveled from ${originalLevel} to ${user.level})`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to grant skill points on level up: ${(err as Error).message}`,
        );
      }
    }

    // Lưu user
    await this.usersRepository.save(user);

    // Ensure derived stats are recomputed authoritatively after level up and heal the player.
    // Note: Since equip doesn't change on level up, we don't need to recompute stats.
    // applyLevelUpStats has already updated the userStats correctly.
    // Recomputation is only needed when equip changes.
    // try {
    //   // Schedule recompute asynchronously to avoid transactional/visibility
    //   // issues where item relations may not be visible in the immediate call
    //   // context after we save the user. Running recompute via setImmediate
    //   // allows the DB commit / event loop to settle so repository queries
    //   // will see the equipped items and set rows reliably.
    //   setImmediate(() => {
    //     void this.userStatsService
    //       .recomputeAndPersistForUser(user.id, { fillCurrentHp: true })
    //       .catch((err) =>
    //         this.logger.warn(
    //           'Failed to recompute stats after level up (async): ' +
    //             ((err as Error)?.message || err),
    //         ),
    //       );
    //   });
    // } catch (e) {
    //   this.logger.warn(
    //     'Failed to schedule recompute after level up: ' +
    //       ((e as Error)?.message || e),
    //   );
    // }

    // try {
    //   await this.userPowerService.computeAndSaveForUser(user.id);
    // } catch (err) {
    //   this.logger.error('Failed to compute user_power after level up', err);
    // }

    // Evaluate possible awakenings/promotions after level up
    // try {
    //   // Emit an event so advancement logic can be handled by a different module
    //   try {
    //     this.eventsService.emit('user.levelUp', {
    //       userId: user.id,
    //       oldLevel: user.level - 1,
    //       newLevel: user.level,
    //     });
    //   } catch (err) {
    //     this.logger.error(
    //       'Failed to emit levelUp event: ' + (err as Error).message,
    //     );
    //   }
    // } catch (err) {
    //   this.logger.error(
    //     'Failed to evaluate advancement after level up: ' +
    //       (err as Error).message,
    //   );
    // }

    return user;
  }

  // Search users by username for admin
  async searchUsers(query: string): Promise<Partial<User>[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const users = await this.usersRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.username', 'user.level', 'user.characterClass'])
      .where('user.username ILIKE :query', { query: `%${query}%` })
      .orderBy('user.username', 'ASC')
      .limit(10)
      .getMany();

    return users;
  }
}
