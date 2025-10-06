import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis.provider';

interface CombatPattern {
  userId: number;
  intervals: number[]; // Time between combats
  avgInterval: number;
  stdDev: number;
  isSuspicious: boolean;
  reason?: string;
}

interface FarmingPattern {
  userId: number;
  actionsPerHour: number;
  totalActions: number;
  farmingScore: number; // 0-100
  isFarming: boolean;
}

@Injectable()
export class BehavioralAnalysisService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ========================================
  // 🔍 COMBAT PATTERN ANALYSIS
  // ========================================

  /**
   * Track combat action (call after each combat)
   */
  async trackCombatAction(userId: number): Promise<void> {
    const now = Date.now();
    const key = `combat_pattern:${userId}`;

    // Store last 50 combat timestamps
    await this.redis.lpush(key, now.toString());
    await this.redis.ltrim(key, 0, 49);
    await this.redis.expire(key, 86400); // 24 hours
  }

  /**
   * Analyze combat pattern for suspicious behavior
   */
  async analyzeCombatPattern(userId: number): Promise<CombatPattern> {
    const key = `combat_pattern:${userId}`;
    const timestamps = await this.redis.lrange(key, 0, 49);

    if (timestamps.length < 10) {
      return {
        userId,
        intervals: [],
        avgInterval: 0,
        stdDev: 0,
        isSuspicious: false,
      };
    }

    // Calculate intervals between combats
    const intervals: number[] = [];
    for (let i = 0; i < timestamps.length - 1; i++) {
      const interval = parseInt(timestamps[i]) - parseInt(timestamps[i + 1]);
      intervals.push(interval);
    }

    // Calculate stats
    const avgInterval =
      intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) /
      intervals.length;
    const stdDev = Math.sqrt(variance);

    // 🚨 SUSPICIOUS: Combat intervals too consistent (bot-like)
    const isSuspicious = stdDev < 5000 && avgInterval < 30000; // <30s avg, <5s stdDev

    return {
      userId,
      intervals,
      avgInterval,
      stdDev,
      isSuspicious,
      reason: isSuspicious
        ? 'Combat intervals too consistent (potential bot)'
        : undefined,
    };
  }

  // ========================================
  // 🌾 FARMING DETECTION
  // ========================================

  /**
   * Track farming action (explore, dungeon, etc.)
   */
  async trackFarmingAction(
    userId: number,
    actionType: 'explore' | 'dungeon' | 'boss',
  ): Promise<void> {
    const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const key = `farming:${userId}:${hour}`;

    await this.redis.hincrby(key, actionType, 1);
    await this.redis.expire(key, 7200); // 2 hours
  }

  /**
   * Analyze farming behavior
   */
  async analyzeFarmingPattern(userId: number): Promise<FarmingPattern> {
    const currentHour = new Date().toISOString().slice(0, 13);
    const lastHours = [];

    // Get last 6 hours of data
    for (let i = 0; i < 6; i++) {
      const date = new Date(Date.now() - i * 3600000);
      const hour = date.toISOString().slice(0, 13);
      lastHours.push(hour);
    }

    let totalActions = 0;
    for (const hour of lastHours) {
      const key = `farming:${userId}:${hour}`;
      const data = await this.redis.hgetall(key);

      if (data) {
        totalActions += Object.values(data).reduce(
          (sum, val) => sum + parseInt(val),
          0,
        );
      }
    }

    const actionsPerHour = totalActions / 6;

    // 🚨 FARMING SCORE CALCULATION
    let farmingScore = 0;

    // High actions per hour
    if (actionsPerHour > 20) farmingScore += 30; // 20+ actions/hour
    if (actionsPerHour > 40) farmingScore += 30; // 40+ actions/hour (very suspicious)

    // Continuous activity (no breaks)
    const hasBreaks = lastHours.some(async (hour) => {
      const key = `farming:${userId}:${hour}`;
      const data = await this.redis.hgetall(key);
      return !data || Object.keys(data).length === 0;
    });

    if (!hasBreaks) farmingScore += 20; // No breaks in 6 hours

    // Bot-like consistency
    const combatPattern = await this.analyzeCombatPattern(userId);
    if (combatPattern.isSuspicious) farmingScore += 20;

    const isFarming = farmingScore > 50;

    return {
      userId,
      actionsPerHour,
      totalActions,
      farmingScore,
      isFarming,
    };
  }

  // ========================================
  // 🚨 AUTO-FLAGGING
  // ========================================

  /**
   * Auto-flag suspicious farming behavior
   */
  async autoFlagSuspiciousBehavior(userId: number): Promise<void> {
    const farmingPattern = await this.analyzeFarmingPattern(userId);
    const combatPattern = await this.analyzeCombatPattern(userId);

    if (farmingPattern.isFarming || combatPattern.isSuspicious) {
      // Update user suspicious score
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) return;

      let newScore = user.suspiciousScore || 0;
      if (farmingPattern.isFarming) newScore += 25;
      if (combatPattern.isSuspicious) newScore += 20;

      await this.userRepository.update(userId, {
        isSuspicious: newScore > 40,
        suspiciousScore: Math.min(newScore, 100),
        accountFlags: {
          ...user.accountFlags,
          farmingDetected: farmingPattern.isFarming,
          botCombatPattern: combatPattern.isSuspicious,
        },
      } as any);

      // Log to Redis
      await this.redis.lpush(
        'behavioral_flags',
        JSON.stringify({
          userId,
          timestamp: new Date().toISOString(),
          farmingScore: farmingPattern.farmingScore,
          combatSuspicious: combatPattern.isSuspicious,
          newSuspiciousScore: newScore,
        }),
      );
      await this.redis.ltrim('behavioral_flags', 0, 999);
    }
  }

  /**
   * Get behavioral analysis summary for admin dashboard
   */
  async getBehavioralSummary(userId: number): Promise<{
    combat: CombatPattern;
    farming: FarmingPattern;
    overallScore: number;
  }> {
    const combat = await this.analyzeCombatPattern(userId);
    const farming = await this.analyzeFarmingPattern(userId);

    const overallScore = Math.min(
      (combat.isSuspicious ? 40 : 0) + (farming.isFarming ? 60 : 0),
      100,
    );

    return {
      combat,
      farming,
      overallScore,
    };
  }
}
