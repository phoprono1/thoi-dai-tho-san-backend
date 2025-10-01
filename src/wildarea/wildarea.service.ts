import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WildAreaMonster } from './wildarea.entity';
import { Monster } from '../monsters/monster.entity';

@Injectable()
export class WildAreaService {
  constructor(
    @InjectRepository(WildAreaMonster)
    private wildAreaRepository: Repository<WildAreaMonster>,
    @InjectRepository(Monster)
    private monsterRepository: Repository<Monster>,
  ) {}

  async findAll(): Promise<WildAreaMonster[]> {
    return this.wildAreaRepository.find({
      where: { isActive: true },
      order: { minLevel: 'ASC', spawnWeight: 'DESC' },
    });
  }

  async findByLevelRange(
    playerLevel: number,
  ): Promise<{ monster: Monster; weight: number }[]> {
    // Get wildarea monsters that can spawn for this player level
    // Player level should be within [minLevel, maxLevel] range
    const wildAreaMonsters = await this.wildAreaRepository
      .createQueryBuilder('wa')
      .leftJoinAndSelect('wa.monster', 'monster')
      .where('wa.isActive = :isActive', { isActive: true })
      .andWhere('monster.isActive = :monsterActive', { monsterActive: true })
      .andWhere(':playerLevel BETWEEN wa.minLevel AND wa.maxLevel', {
        playerLevel,
      })
      .orderBy('wa.spawnWeight', 'DESC')
      .getMany();

    return wildAreaMonsters.map((wa) => ({
      monster: wa.monster,
      weight: Number(wa.spawnWeight),
    }));
  }

  async findById(id: number): Promise<WildAreaMonster | null> {
    return this.wildAreaRepository.findOne({
      where: { id },
      relations: ['monster'],
    });
  }

  async create(data: {
    monsterId: number;
    minLevel: number;
    maxLevel: number;
    spawnWeight?: number;
    description?: string;
  }): Promise<WildAreaMonster> {
    // Validate monster exists
    const monster = await this.monsterRepository.findOne({
      where: { id: data.monsterId, isActive: true },
    });
    if (!monster) {
      throw new Error('Monster not found or inactive');
    }

    // Validate level range
    if (data.minLevel > data.maxLevel) {
      throw new Error('minLevel cannot be greater than maxLevel');
    }

    const wildAreaMonster = this.wildAreaRepository.create({
      monsterId: data.monsterId,
      minLevel: data.minLevel,
      maxLevel: data.maxLevel,
      spawnWeight: data.spawnWeight || 1.0,
      description: data.description,
    });

    return this.wildAreaRepository.save(wildAreaMonster);
  }

  async update(
    id: number,
    data: Partial<{
      minLevel: number;
      maxLevel: number;
      spawnWeight: number;
      description: string;
      isActive: boolean;
    }>,
  ): Promise<WildAreaMonster> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('WildArea monster not found');
    }

    // Validate level range if provided
    const minLevel = data.minLevel ?? existing.minLevel;
    const maxLevel = data.maxLevel ?? existing.maxLevel;
    if (minLevel > maxLevel) {
      throw new Error('minLevel cannot be greater than maxLevel');
    }

    await this.wildAreaRepository.update(id, data);
    return this.findById(id) as Promise<WildAreaMonster>;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('WildArea monster not found');
    }

    // Soft delete by setting isActive to false
    await this.wildAreaRepository.update(id, { isActive: false });
  }

  async hardDelete(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('WildArea monster not found');
    }

    await this.wildAreaRepository.delete(id);
  }

  // Weighted random selection for spawning
  async selectRandomMonsters(
    playerLevel: number,
    count: number,
  ): Promise<Monster[]> {
    const candidates = await this.findByLevelRange(playerLevel);
    if (candidates.length === 0) {
      throw new Error('No monsters available for this level range');
    }

    const selected: Monster[] = [];
    for (let i = 0; i < count; i++) {
      // Weighted random selection
      const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
      let random = Math.random() * totalWeight;

      for (const candidate of candidates) {
        random -= candidate.weight;
        if (random <= 0) {
          selected.push(candidate.monster);
          break;
        }
      }
    }

    return selected;
  }

  // Get monsters that can spawn in specific level ranges
  async getMonstersByLevelRange(
    minLevel: number,
    maxLevel: number,
  ): Promise<Monster[]> {
    const wildAreaMonsters = await this.wildAreaRepository
      .createQueryBuilder('wa')
      .leftJoinAndSelect('wa.monster', 'monster')
      .where('wa.isActive = :isActive', { isActive: true })
      .andWhere('monster.isActive = :monsterActive', { monsterActive: true })
      .andWhere('(wa.minLevel <= :maxLevel AND wa.maxLevel >= :minLevel)', {
        minLevel,
        maxLevel,
      })
      .orderBy('wa.spawnWeight', 'DESC')
      .getMany();

    return wildAreaMonsters.map((wa) => wa.monster);
  }

  // Statistics
  async getStats() {
    const total = await this.wildAreaRepository.count({
      where: { isActive: true },
    });

    const levelDistribution = await this.wildAreaRepository
      .createQueryBuilder('wa')
      .select('wa.minLevel', 'minLevel')
      .addSelect('wa.maxLevel', 'maxLevel')
      .addSelect('COUNT(*)', 'count')
      .where('wa.isActive = :isActive', { isActive: true })
      .groupBy('wa.minLevel, wa.maxLevel')
      .orderBy('wa.minLevel', 'ASC')
      .getRawMany();

    return {
      total,
      levelDistribution,
    };
  }
}
