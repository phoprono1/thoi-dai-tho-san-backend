import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from './user.entity';
import { LevelsService } from '../levels/levels.service';
import { UserStatsService } from '../user-stats/user-stats.service';
import { UserPowerService } from '../user-power/user-power.service';

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
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: number): Promise<User | null> {
    const user = await this.usersRepository.findOneBy({ id });
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
      await queryRunner.manager.delete('guild_members', { userId: id });
      // If user was guild leader, set leaderId to null in guilds
      await queryRunner.manager.update(
        'guilds',
        { leaderId: id },
        { leaderId: null },
      );

      // Chat messages, combat logs, pvp players, room_player
      await queryRunner.manager.delete('chat_messages', { userId: id });
      await queryRunner.manager.delete('boss_combat_log', { userId: id });
      await queryRunner.manager.delete('pvp_players', { userId: id });
      await queryRunner.manager.delete('room_player', { playerId: id });

      // Finally remove the user row
      await queryRunner.manager.delete('user', { id });

      await queryRunner.commitTransaction();
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
    }

    // Lưu user
    await this.usersRepository.save(user);

    return user;
  }
}
