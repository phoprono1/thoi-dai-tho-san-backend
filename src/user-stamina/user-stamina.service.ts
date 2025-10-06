import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStamina } from './user-stamina.entity';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../common/redis.provider';

@Injectable()
export class UserStaminaService {
  constructor(
    @InjectRepository(UserStamina)
    private userStaminaRepository: Repository<UserStamina>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getUserStamina(userId: number): Promise<UserStamina> {
    let stamina = await this.userStaminaRepository.findOne({
      where: { userId },
    });

    if (!stamina) {
      // Create new stamina record for user
      stamina = this.userStaminaRepository.create({
        userId,
        currentStamina: 100,
        maxStamina: 100,
        lastRegenTime: new Date(),
      });
      await this.userStaminaRepository.save(stamina);
    }

    // Regenerate stamina
    stamina = await this.regenerateStamina(stamina);
    return stamina;
  }

  async getUserStaminaWithoutRegen(userId: number): Promise<UserStamina> {
    let stamina = await this.userStaminaRepository.findOne({
      where: { userId },
    });

    if (!stamina) {
      // Create new stamina record for user
      stamina = this.userStaminaRepository.create({
        userId,
        currentStamina: 100,
        maxStamina: 100,
        lastRegenTime: new Date(),
      });
      await this.userStaminaRepository.save(stamina);
    }

    return stamina;
  }

  async consumeStamina(
    userId: number,
    amount: number,
    ip?: string,
  ): Promise<UserStamina> {
    const stamina = await this.getUserStamina(userId);

    if (stamina.currentStamina < amount) {
      throw new Error('Not enough stamina');
    }

    // 🛡️ CHECK GLOBAL IP LIMIT (if IP provided)
    if (ip) {
      const canConsume = await this.checkGlobalStaminaLimit(ip, amount);
      if (!canConsume) {
        throw new HttpException(
          'Daily stamina limit reached for this IP (5000/day). This prevents multi-accounting abuse.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    stamina.currentStamina -= amount;
    stamina.lastRegenTime = new Date();

    // Track global usage if IP provided
    if (ip) {
      await this.trackGlobalStaminaUsage(ip, amount);
    }

    return this.userStaminaRepository.save(stamina);
  }

  private async regenerateStamina(stamina: UserStamina): Promise<UserStamina> {
    const now = new Date();
    const lastRegen = stamina.lastRegenTime || now;
    const timeDiff = now.getTime() - lastRegen.getTime();

    // Regenerate 10 stamina per 5 minutes
    const regenRate = 10; // stamina per regen period
    const regenPeriod = 5 * 60 * 1000; // 5 minutes in milliseconds

    const regenAmount = Math.floor(timeDiff / regenPeriod) * regenRate;

    if (regenAmount > 0) {
      stamina.currentStamina = Math.min(
        stamina.maxStamina,
        stamina.currentStamina + regenAmount,
      );
      stamina.lastRegenTime = new Date(
        lastRegen.getTime() + (regenAmount / regenRate) * regenPeriod,
      );

      await this.userStaminaRepository.save(stamina);
    }

    return stamina;
  }

  async updateMaxStamina(userId: number, newMax: number): Promise<UserStamina> {
    const stamina = await this.getUserStamina(userId);
    stamina.maxStamina = newMax;
    stamina.currentStamina = Math.min(stamina.currentStamina, newMax);
    return this.userStaminaRepository.save(stamina);
  }

  /**
   * Restore current stamina for a user by amount. Persists the change and
   * updates lastRegenTime to now so passive regen is delayed appropriately.
   */
  async restoreStamina(userId: number, amount: number): Promise<UserStamina> {
    const stamina = await this.getUserStaminaWithoutRegen(userId);
    stamina.currentStamina = Math.min(
      stamina.maxStamina,
      (stamina.currentStamina || 0) + Math.max(0, Math.floor(amount)),
    );
    stamina.lastRegenTime = new Date();
    return this.userStaminaRepository.save(stamina);
  }

  // ========================================
  // 🛡️ ANTI-MULTI-ACCOUNTING: GLOBAL LIMITS
  // ========================================

  /**
   * Check if IP has exceeded global stamina usage limit
   * LIMIT: 5000 stamina per IP per day (~8 hours gameplay)
   */
  private async checkGlobalStaminaLimit(
    ip: string,
    requiredStamina: number,
  ): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dailyKey = `stamina_usage:${ip}:${today}`;

    const totalUsed = parseInt((await this.redis.get(dailyKey)) || '0');

    // 🚨 LIMIT: 5000 stamina per day per IP
    // Reasoning:
    // - Normal player: ~100 stamina/hour × 8 hours = 800 stamina
    // - Active player: ~100 stamina/hour × 10 hours = 1000 stamina
    // - 5000 allows 5 accounts OR 1 very active account
    // - Prevents 70 accounts × 100 stamina = 7000+ abuse
    const DAILY_LIMIT = 5000;

    if (totalUsed + requiredStamina > DAILY_LIMIT) {
      return false;
    }

    return true;
  }

  /**
   * Track stamina usage per IP (for global limit enforcement)
   */
  private async trackGlobalStaminaUsage(
    ip: string,
    amount: number,
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `stamina_usage:${ip}:${today}`;

    await this.redis.incrby(dailyKey, amount);
    await this.redis.expire(dailyKey, 86400 * 2); // Keep for 2 days
  }

  /**
   * Get current stamina usage for an IP (admin dashboard)
   */
  async getIPStaminaUsage(ip: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `stamina_usage:${ip}:${today}`;
    return parseInt((await this.redis.get(dailyKey)) || '0');
  }
}
