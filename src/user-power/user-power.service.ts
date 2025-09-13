/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserPower } from './user-power.entity';
import { computeCombatPowerFromStats } from './computeCombatPower';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import { UserItem } from '../user-items/user-item.entity';

@Injectable()
export class UserPowerService {
  private readonly logger = new Logger(UserPowerService.name);

  constructor(
    @InjectRepository(UserPower)
    private readonly userPowerRepo: Repository<UserPower>,
    private readonly dataSource: DataSource,
  ) {}

  private _redisClient: Redis | null = null;
  private get redis() {
    if (this._redisClient) return this._redisClient;
    const url = process.env.REDIS_LEADERBOARD_URL || process.env.REDIS_URL;
    if (!url) return null;
    this._redisClient = new Redis(url);
    return this._redisClient;
  }

  async computeAndSaveForUser(userId: number): Promise<number> {
    // Load user, stats, and equipped items
    const user = await this.dataSource.manager.findOne(User, {
      where: { id: userId },
    });
    if (!user) throw new Error('User not found');

    const stat = await this.dataSource.manager.findOne(UserStat, {
      where: { userId },
    });

    const equipped = await this.dataSource.manager.find(UserItem, {
      where: { userId, isEquipped: true },
      relations: ['item'],
    });

    const power = computeCombatPowerFromStats(stat || {}, equipped || []);

    let up = await this.userPowerRepo.findOne({ where: { userId } });
    if (!up) {
      up = this.userPowerRepo.create({ userId, combatPower: power });
    } else {
      up.combatPower = power;
    }
    await this.userPowerRepo.save(up);

    // push to Redis leaderboard (if configured)
    try {
      const r = this.redis;
      if (r) {
        // sorted set key for global leaderboard
        await r.zadd('leaderboard:global', String(power), String(userId));
      }
    } catch (err) {
      this.logger.warn(`Failed to push to redis leaderboard: ${err?.message}`);
    }
    this.logger.debug(`Saved power=${power} for user=${userId}`);
    return power;
  }

  async backfillAll(batch = 200) {
    let offset = 0;
    while (true) {
      const users: User[] = await this.dataSource.manager.find(User, {
        skip: offset,
        take: batch,
      });
      if (!users || users.length === 0) break;
      for (const u of users) {
        try {
          await this.computeAndSaveForUser(u.id);
        } catch (err) {
          this.logger.warn(`Failed compute for user ${u.id}: ${err.message}`);
        }
      }
      offset += users.length;
    }
  }
}
