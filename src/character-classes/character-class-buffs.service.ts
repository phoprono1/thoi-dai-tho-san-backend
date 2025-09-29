import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CharacterClassHistory } from './character-class-history.entity';

@Injectable()
export class CharacterClassBuffsService {
  constructor(
    @InjectRepository(CharacterClassHistory)
    private characterClassHistoryRepository: Repository<CharacterClassHistory>,
  ) {}

  /**
   * Get cumulative class buffs from all classes the user has been through
   * Each tier gives permanent buffs that stack
   */
  async getClassHistoryBuffs(userId: number): Promise<{
    strength: number;
    intelligence: number;
    dexterity: number;
    vitality: number;
    luck: number;
  }> {
    // Get all unique classes from user's history
    const classHistory = await this.characterClassHistoryRepository.find({
      where: { characterId: userId },
      relations: ['newClass'],
      order: { triggeredAt: 'ASC' },
    });

    const uniqueClassIds = new Set<number>();
    const totalBuffs = {
      strength: 0,
      intelligence: 0,
      dexterity: 0,
      vitality: 0,
      luck: 0,
    };

    // Add buffs from each unique class tier the user has achieved
    for (const history of classHistory) {
      if (history.newClass && !uniqueClassIds.has(history.newClassId)) {
        uniqueClassIds.add(history.newClassId);

        // Each tier gives permanent buffs
        const tierMultiplier = history.newClass.tier || 1;
        const baseBuff = tierMultiplier * 2; // Tier 1 = +2, Tier 2 = +4, etc.

        if (history.newClass.statBonuses) {
          // Add class-specific bonuses
          totalBuffs.strength += history.newClass.statBonuses.strength || 0;
          totalBuffs.intelligence +=
            history.newClass.statBonuses.intelligence || 0;
          totalBuffs.dexterity += history.newClass.statBonuses.dexterity || 0;
          totalBuffs.vitality += history.newClass.statBonuses.vitality || 0;
          totalBuffs.luck += history.newClass.statBonuses.luck || 0;
        }

        // Add tier-based permanent buffs
        totalBuffs.strength += baseBuff;
        totalBuffs.intelligence += baseBuff;
        totalBuffs.dexterity += baseBuff;
        totalBuffs.vitality += baseBuff;
        totalBuffs.luck += baseBuff;
      }
    }

    return totalBuffs;
  }
}
