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

  // Tính tổng core attribute bonuses từ level 1 đến level hiện tại (Additive system)
  async getTotalLevelStats(targetLevel: number): Promise<{
    strength: number;
    intelligence: number;
    dexterity: number;
    vitality: number;
    luck: number;
  }> {
    const levels = await this.levelsRepository
      .createQueryBuilder('level')
      .select([
        'level.strength',
        'level.intelligence',
        'level.dexterity',
        'level.vitality',
        'level.luck',
      ])
      .where('level.level <= :targetLevel', { targetLevel })
      .orderBy('level.level', 'ASC')
      .getMany();

    const totalStats = {
      strength: 0,
      intelligence: 0,
      dexterity: 0,
      vitality: 0,
      luck: 0,
    };

    for (const level of levels) {
      totalStats.strength += level.strength || 0;
      totalStats.intelligence += level.intelligence || 0;
      totalStats.dexterity += level.dexterity || 0;
      totalStats.vitality += level.vitality || 0;
      totalStats.luck += level.luck || 0;
    }

    return totalStats;
  }

  // Tính core attribute bonuses của level cụ thể
  async getLevelStats(levelNumber: number): Promise<{
    strength: number;
    intelligence: number;
    dexterity: number;
    vitality: number;
    luck: number;
  } | null> {
    const level = await this.findByLevel(levelNumber);
    if (!level) return null;

    return {
      strength: level.strength || 0,
      intelligence: level.intelligence || 0,
      dexterity: level.dexterity || 0,
      vitality: level.vitality || 0,
      luck: level.luck || 0,
    };
  }
}
