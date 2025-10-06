import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../../users/user.entity';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis.provider';

export interface MultiAccountInfo {
  accountCount: number;
  accounts: User[];
  isSuspicious: boolean;
}

@Injectable()
export class IpTrackingService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Detect if IP has multiple accounts
   */
  async detectMultiAccounts(ip: string): Promise<MultiAccountInfo> {
    // Check cache first
    const cacheKey = `multi_acc:${ip}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Query accounts from this IP
    const accounts = await this.userRepository.find({
      where: [{ registrationIp: ip }, { lastLoginIp: ip }],
      select: [
        'id',
        'username',
        'level',
        'createdAt',
        'isBanned',
        'isSuspicious',
      ],
    });

    const accountCount = accounts.length;
    const isSuspicious = accountCount > 5; // 🚨 Suspicious if >5 accounts

    const result = {
      accountCount,
      accounts,
      isSuspicious,
    };

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(result));

    return result;
  }

  /**
   * Get all IPs used by a user
   */
  async getUserIPs(userId: number): Promise<string[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) return [];

    const ips = new Set<string>();
    if (user.registrationIp) ips.add(user.registrationIp);
    if (user.lastLoginIp) ips.add(user.lastLoginIp);

    return Array.from(ips);
  }

  /**
   * Calculate suspicious score for a user
   */
  async calculateSuspiciousScore(userId: number): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['stats'],
    });

    if (!user) return 0;

    let score = 0;

    // Check 1: Multiple accounts from same IP (+30 points)
    if (user.registrationIp) {
      const multiAccInfo = await this.detectMultiAccounts(user.registrationIp);
      if (multiAccInfo.accountCount > 3) {
        score += 30;
      }
      if (multiAccInfo.accountCount > 10) {
        score += 20; // Extra penalty
      }
    }

    // Check 2: Rapid leveling (+20 points)
    const accountAge = Date.now() - user.createdAt.getTime();
    const hoursOld = accountAge / (1000 * 60 * 60);
    if (user.level > 10 && hoursOld < 6) {
      score += 20; // Level 10+ in 6 hours = suspicious
    }

    // Check 3: Suspicious username pattern (+15 points)
    const suspiciousPattern = /(\w+)_?\d{1,3}$/;
    if (suspiciousPattern.test(user.username)) {
      score += 15;
    }

    // Check 4: Low level, old account (inactive/farming alt) (+10 points)
    const daysOld = accountAge / (1000 * 60 * 60 * 24);
    if (user.level < 5 && daysOld > 7) {
      score += 10;
    }

    // Check 5: Exact stat distribution (bot-like) (+25 points)
    if (user.stats) {
      const stats = [
        user.stats.strength,
        user.stats.intelligence,
        user.stats.dexterity,
        user.stats.vitality,
        user.stats.luck,
      ];

      // All stats equal = likely bot
      if (new Set(stats).size === 1) {
        score += 25;
      }
    }

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Flag account as suspicious
   */
  async flagAccount(userId: number, reason: string): Promise<void> {
    const score = await this.calculateSuspiciousScore(userId);

    await this.userRepository.update(userId, {
      isSuspicious: true,
      suspiciousScore: score,
      accountFlags: {
        multiAccountCluster: true,
      },
    } as any);

    // Log to admin dashboard
    await this.redis.lpush(
      'suspicious_accounts',
      JSON.stringify({
        userId,
        reason,
        score,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /**
   * Get top suspicious IPs (delegate to UsersService)
   */
  async getTopSuspiciousIPs(): Promise<Array<{ ip: string; count: number }>> {
    // Query database for IPs with most accounts
    const result = await this.userRepository
      .createQueryBuilder('user')
      .select('user.registrationIp', 'ip')
      .addSelect('COUNT(*)', 'count')
      .where('user.registrationIp IS NOT NULL')
      .groupBy('user.registrationIp')
      .having('COUNT(*) > :threshold', { threshold: 5 }) // >5 accounts
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany();

    return result.map((row: any) => ({
      ip: row.ip as string,
      count: parseInt(row.count as string),
    }));
  }
}
