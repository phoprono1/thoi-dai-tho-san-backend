import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStat } from './user-stat.entity';

@Injectable()
export class UserStatsService {
  constructor(
    @InjectRepository(UserStat)
    private userStatsRepository: Repository<UserStat>,
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
    return this.userStatsRepository.save(newUserStat);
  }

  async update(
    id: number,
    userStat: Partial<UserStat>,
  ): Promise<UserStat | null> {
    await this.userStatsRepository.update(id, userStat);
    return this.findOne(id);
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
    return userStats;
  }
}
