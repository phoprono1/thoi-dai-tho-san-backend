import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStamina } from './user-stamina.entity';

@Injectable()
export class UserStaminaService {
  constructor(
    @InjectRepository(UserStamina)
    private userStaminaRepository: Repository<UserStamina>,
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

  async consumeStamina(userId: number, amount: number): Promise<UserStamina> {
    const stamina = await this.getUserStamina(userId);

    if (stamina.currentStamina < amount) {
      throw new Error('Not enough stamina');
    }

    stamina.currentStamina -= amount;
    stamina.lastRegenTime = new Date();

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
}
