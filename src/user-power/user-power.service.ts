/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { Repository, DataSource, In } from 'typeorm';
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

  // Leaderboard helpers
  /**
   * Get top N users from leaderboard. Returns array of { userId, score, rank }
   */
  async getTop(
    limit = 100,
  ): Promise<
    Array<{ userId: number; score: number; rank: number; username?: string }>
  > {
    const r = this.redis;
    if (r) {
      try {
        // ZREVRANGE with scores from 0..limit-1
        const items = await r.zrevrange(
          'leaderboard:global',
          0,
          limit - 1,
          'WITHSCORES',
        );
        const out: Array<{ userId: number; score: number; rank: number }> = [];
        for (let i = 0; i < items.length; i += 2) {
          const uid = Number(items[i]);
          const score = Number(items[i + 1]);
          out.push({ userId: uid, score, rank: out.length + 1 });
        }
        // enrich with usernames in a single batch
        const ids = out.map((o) => o.userId);
        if (ids.length > 0) {
          const users = await this.dataSource.manager.find(User, {
            where: { id: In(ids) },
          });
          const nameById = new Map(users.map((u) => [u.id, u.username]));
          return out.map((o) => ({
            ...o,
            username: nameById.get(o.userId) || null,
          }));
        }
        return out;
      } catch (err) {
        this.logger.warn(`Redis leaderboard read failed: ${err?.message}`);
        // fallthrough to DB
      }
    }

    // Fallback: query DB ordered by combatPower desc
    const rows = await this.userPowerRepo.find({
      order: { combatPower: 'DESC' },
      take: limit,
    });

    const out = rows.map((r, idx) => ({
      userId: r.userId,
      score: Number(r.combatPower || 0),
      rank: idx + 1,
    }));
    // enrich with usernames
    const ids = out.map((o) => o.userId);
    if (ids.length > 0) {
      const users = await this.dataSource.manager.find(User, {
        where: { id: In(ids) },
      });
      const nameById = new Map(users.map((u) => [u.id, u.username]));
      return out.map((o) => ({
        ...o,
        username: nameById.get(o.userId) || null,
      }));
    }
    return out;
  }

  /**
   * Get leaderboard slice around a user. Returns members with rank and score.
   */
  async getAround(
    userId: number,
    radius = 5,
  ): Promise<
    { userId: number; score: number; rank: number; username?: string }[]
  > {
    const r = this.redis;
    if (r) {
      try {
        const rank = await r.zrevrank('leaderboard:global', String(userId));
        if (rank === null) {
          // user not in redis set, fallback
          throw new Error('not-in-redis');
        }
        const start = Math.max(0, Number(rank) - radius);
        const end = Number(rank) + radius;
        const items = await r.zrevrange(
          'leaderboard:global',
          start,
          end,
          'WITHSCORES',
        );
        const out: Array<{ userId: number; score: number; rank: number }> = [];
        let currentRank = start + 1; // ranks are 1-based
        for (let i = 0; i < items.length; i += 2) {
          const uid = Number(items[i]);
          const score = Number(items[i + 1]);
          out.push({ userId: uid, score, rank: currentRank });
          currentRank += 1;
        }
        // enrich with usernames
        const ids = out.map((o) => o.userId);
        if (ids.length > 0) {
          const users = await this.dataSource.manager.find(User, {
            where: { id: In(ids) },
          });
          const nameById = new Map(users.map((u) => [u.id, u.username]));
          return out.map((o) => ({
            ...o,
            username: nameById.get(o.userId) || null,
          }));
        }
        return out;
      } catch (err) {
        this.logger.warn(`Redis around read failed: ${err?.message}`);
        // fallthrough to DB
      }
    }

    // DB fallback: load ordered list and pick slice around user
    const all = await this.userPowerRepo.find({
      order: { combatPower: 'DESC' },
    });
    const idx = all.findIndex((x) => x.userId === userId);
    const center = idx >= 0 ? idx : 0;
    const start = Math.max(0, center - radius);
    const slice = all.slice(start, center + radius + 1);
    const out = slice.map((r, i) => ({
      userId: r.userId,
      score: Number(r.combatPower || 0),
      rank: start + i + 1,
    }));
    const ids = out.map((o) => o.userId);
    if (ids.length > 0) {
      const users = await this.dataSource.manager.find(User, {
        where: { id: In(ids) },
      });
      const nameById = new Map(users.map((u) => [u.id, u.username]));
      return out.map((o) => ({
        ...o,
        username: nameById.get(o.userId) || null,
      }));
    }
    return out;
  }
}
