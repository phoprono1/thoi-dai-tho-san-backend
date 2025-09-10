/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dungeon } from './dungeon.entity';
import { MonsterService } from '../monsters/monster.service';

@Injectable()
export class DungeonsService {
  constructor(
    @InjectRepository(Dungeon)
    private dungeonsRepository: Repository<Dungeon>,
    private monsterService: MonsterService,
  ) {}

  async findAll(): Promise<Dungeon[]> {
    const dungeons = await this.dungeonsRepository.find();
    // Temporarily disable populateMonsters to test
    // return this.populateMonsters(dungeons);
    return dungeons;
  }

  async findOne(id: number): Promise<Dungeon | null> {
    const dungeon = await this.dungeonsRepository.findOne({ where: { id } });
    if (!dungeon) return null;

    // Temporarily disable populateMonsters to test
    // const dungeons = await this.populateMonsters([dungeon]);
    // return dungeons[0];
    return dungeon;
  }

  async create(dungeon: Partial<Dungeon>): Promise<Dungeon> {
    const newDungeon = this.dungeonsRepository.create(dungeon);
    const savedDungeon = await this.dungeonsRepository.save(newDungeon);

    const dungeons = await this.populateMonsters([savedDungeon]);
    return dungeons[0];
  }

  async update(id: number, dungeon: Partial<Dungeon>): Promise<Dungeon | null> {
    await this.dungeonsRepository.update(id, dungeon);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    try {
      const result = await this.dungeonsRepository.delete(id);
      if (result.affected === 0) {
        // No dungeon found
      } else {
        // Successfully deleted
      }
    } catch (error) {
      console.error(`Database error during deletion of dungeon ${id}:`, error);
      throw error;
    }
  }

  private async populateMonsters(dungeons: Dungeon[]): Promise<Dungeon[]> {
    const populatedDungeons: Dungeon[] = [];

    for (const dungeon of dungeons) {
      const populatedDungeon = { ...dungeon };

      // Populate monsters from monsterIds
      if (dungeon.monsterIds && dungeon.monsterIds.length > 0) {
        const monsters: any[] = [];
        for (const monsterId of dungeon.monsterIds) {
          try {
            const monster = await this.monsterService.getMonsterById(monsterId);
            if (monster) {
              // Get count for this monster type
              const monsterCount =
                dungeon.monsterCounts?.find((mc) => mc.monsterId === monsterId)
                  ?.count || 1;

              monsters.push({
                ...monster,
                count: monsterCount,
              });
            }
          } catch (error) {
            console.error(`Error fetching monster ${monsterId}:`, error);
            // Skip this monster if there's an error
          }
        }
        (populatedDungeon as any).monsters = monsters;
      } else {
        (populatedDungeon as any).monsters = [];
      }

      populatedDungeons.push(populatedDungeon);
    }

    return populatedDungeons;
  }
}
