import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStat } from './user-stat.entity';
import { UserPowerService } from '../user-power/user-power.service';

@Injectable()
export class UserStatsService {
  constructor(
    @InjectRepository(UserStat)
    private userStatsRepository: Repository<UserStat>,
    private readonly userPowerService: UserPowerService,
  ) {}

  findAll(): Promise<UserStat[]> {
    return this.userStatsRepository.find({ relations: ['user'] });
  }

  findOne(id: number): Promise<UserStat | null> {
    return this.userStatsRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  findByUserId(userId: number): Promise<UserStat | null> {
    return this.userStatsRepository.findOne({
      where: { userId },
      relations: ['user'],
    });
  }

  async create(userStat: Partial<UserStat>): Promise<UserStat> {
    const newUserStat = this.userStatsRepository.create(userStat);
    const saved = await this.userStatsRepository.save(newUserStat);
    // Ensure user_power exists for new user stat
    try {
      if (saved.userId) {
        await this.userPowerService.computeAndSaveForUser(saved.userId);
      }
    } catch {
      // best-effort: don't fail create if compute fails
    }
    return saved;
  }

  async update(
    id: number,
    userStat: Partial<UserStat>,
  ): Promise<UserStat | null> {
    await this.userStatsRepository.update(id, userStat);
    const s = await this.findOne(id);
    try {
      if (s && s.userId) {
        await this.userPowerService.computeAndSaveForUser(s.userId);
      }
    } catch {
      // continue
    }
    return s;
  }

  async remove(id: number): Promise<void> {
    await this.userStatsRepository.delete(id);
  }

  // Cập nhật stats khi level up (Additive system)
  async applyLevelUpStats(
    userId: number,
    levelStats: {
      maxHp: number;
      attack: number;
      defense: number;
    },
  ): Promise<UserStat | null> {
    const userStats = await this.findByUserId(userId);
    if (!userStats) return null;

    // Cộng thêm stats từ level mới
    userStats.maxHp += levelStats.maxHp;
    userStats.attack += levelStats.attack;
    userStats.defense += levelStats.defense;

    // Hồi đầy HP khi level up
    userStats.currentHp = userStats.maxHp;

    await this.userStatsRepository.save(userStats);
    try {
      if (userStats.userId) {
        await this.userPowerService.computeAndSaveForUser(userStats.userId);
      }
    } catch {
      // continue
    }
    return userStats;
  }

  // Reset và tính lại toàn bộ stats từ đầu (cho trường hợp cần sync)
  async recalculateTotalStats(
    userId: number,
    totalLevelStats: {
      maxHp: number;
      attack: number;
      defense: number;
    },
    baseStats: {
      maxHp: number;
      attack: number;
      defense: number;
    },
  ): Promise<UserStat | null> {
    const userStats = await this.findByUserId(userId);
    if (!userStats) return null;

    // Reset về base stats + total level stats
    userStats.maxHp = baseStats.maxHp + totalLevelStats.maxHp;
    userStats.attack = baseStats.attack + totalLevelStats.attack;
    userStats.defense = baseStats.defense + totalLevelStats.defense;

    // Hồi đầy HP khi recalculate
    userStats.currentHp = userStats.maxHp;

    await this.userStatsRepository.save(userStats);
    try {
      if (userStats.userId) {
        await this.userPowerService.computeAndSaveForUser(userStats.userId);
      }
    } catch {
      // continue
    }
    return userStats;
  }
}
