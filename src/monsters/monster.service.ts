import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Monster, MonsterType } from './monster.entity';

@Injectable()
export class MonsterService {
  constructor(
    @InjectRepository(Monster)
    private monsterRepository: Repository<Monster>,
  ) {}

  async createMonster(monsterData: Partial<Monster>): Promise<Monster> {
    const monster = this.monsterRepository.create(monsterData);
    return this.monsterRepository.save(monster);
  }

  async getAllMonsters(): Promise<Monster[]> {
    return this.monsterRepository.find({
      where: { isActive: true },
      order: { level: 'ASC', name: 'ASC' },
    });
  }

  async getMonsterById(id: number): Promise<Monster | null> {
    return this.monsterRepository.findOne({ where: { id } });
  }

  async getMonstersByType(type: MonsterType): Promise<Monster[]> {
    return this.monsterRepository.find({
      where: { type, isActive: true },
      order: { level: 'ASC', name: 'ASC' },
    });
  }

  async getMonstersByLevelRange(
    minLevel: number,
    maxLevel: number,
  ): Promise<Monster[]> {
    return this.monsterRepository
      .createQueryBuilder('monster')
      .where('monster.level BETWEEN :minLevel AND :maxLevel', {
        minLevel,
        maxLevel,
      })
      .andWhere('monster.isActive = :isActive', { isActive: true })
      .orderBy('monster.level', 'ASC')
      .addOrderBy('monster.name', 'ASC')
      .getMany();
  }

  async updateMonster(
    id: number,
    updateData: Partial<Monster>,
  ): Promise<Monster> {
    await this.monsterRepository.update(id, updateData);
    const updatedMonster = await this.getMonsterById(id);
    if (!updatedMonster) {
      throw new Error('Monster not found after update');
    }
    return updatedMonster;
  }

  async deleteMonster(id: number): Promise<void> {
    const monster = await this.getMonsterById(id);
    if (!monster) {
      throw new Error('Monster not found');
    }

    // Soft delete by setting isActive to false
    await this.monsterRepository.update(id, { isActive: false });
  }

  async getMonsterStats() {
    const total = await this.monsterRepository.count({
      where: { isActive: true },
    });
    const byType = await this.monsterRepository
      .createQueryBuilder('monster')
      .select('monster.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('monster.isActive = :isActive', { isActive: true })
      .groupBy('monster.type')
      .getRawMany();

    const byElement = await this.monsterRepository
      .createQueryBuilder('monster')
      .select('monster.element', 'element')
      .addSelect('COUNT(*)', 'count')
      .where('monster.isActive = :isActive', { isActive: true })
      .groupBy('monster.element')
      .getRawMany();

    return {
      total,
      byType,
      byElement,
    };
  }
}
