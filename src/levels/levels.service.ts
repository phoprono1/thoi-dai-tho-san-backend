import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Level } from './level.entity';

@Injectable()
export class LevelsService {
  constructor(
    @InjectRepository(Level)
    private levelsRepository: Repository<Level>,
  ) {}

  findAll(): Promise<Level[]> {
    return this.levelsRepository.find({
      order: { level: 'ASC' },
    });
  }

  findOne(id: number): Promise<Level | null> {
    return this.levelsRepository.findOne({ where: { id } });
  }

  findByLevel(level: number): Promise<Level | null> {
    return this.levelsRepository.findOne({ where: { level } });
  }

  async create(level: Partial<Level>): Promise<Level> {
    const newLevel = this.levelsRepository.create(level);
    return this.levelsRepository.save(newLevel);
  }

  async update(id: number, level: Partial<Level>): Promise<Level | null> {
    await this.levelsRepository.update(id, level);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.levelsRepository.delete(id);
  }

  // Tìm level tiếp theo
  async getNextLevel(currentLevel: number): Promise<Level | null> {
    return this.levelsRepository.findOne({
      where: { level: currentLevel + 1 },
    });
  }

  // Tính tổng kinh nghiệm cần để lên level
  async getExperienceRequiredForLevel(targetLevel: number): Promise<number> {
    const levels = await this.levelsRepository.find({
      where: { level: targetLevel },
      select: ['experienceRequired'],
    });

    if (levels.length === 0) return 0;
    return levels[0].experienceRequired;
  }

  // Tính tổng stats từ level 1 đến level hiện tại (Additive system)
  async getTotalLevelStats(targetLevel: number): Promise<{
    maxHp: number;
    attack: number;
    defense: number;
  }> {
    const levels = await this.levelsRepository
      .createQueryBuilder('level')
      .select(['level.maxHp', 'level.attack', 'level.defense'])
      .where('level.level <= :targetLevel', { targetLevel })
      .orderBy('level.level', 'ASC')
      .getMany();

    const totalStats = {
      maxHp: 0,
      attack: 0,
      defense: 0,
    };

    for (const level of levels) {
      totalStats.maxHp += level.maxHp || 0;
      totalStats.attack += level.attack || 0;
      totalStats.defense += level.defense || 0;
    }

    return totalStats;
  }

  // Tính stats của level cụ thể
  async getLevelStats(levelNumber: number): Promise<{
    maxHp: number;
    attack: number;
    defense: number;
  } | null> {
    const level = await this.findByLevel(levelNumber);
    if (!level) return null;

    return {
      maxHp: level.maxHp || 0,
      attack: level.attack || 0,
      defense: level.defense || 0,
    };
  }
}
