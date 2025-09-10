/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  CharacterClass,
  ClassTier,
  AdvancementStatus,
} from './character-class.entity';
import { CharacterAdvancement } from './character-class.entity';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import {
  CombatResult,
  CombatResultType,
} from '../combat-results/combat-result.entity';
import { UserItem } from '../user-items/user-item.entity';
import { QuestService } from '../quests/quest.service';
import {
  CreateCharacterClassDto,
  CharacterClassResponseDto,
  AdvancementCheckResultDto,
  PerformAdvancementDto,
  AdvancementResultDto,
  CharacterAdvancementResponseDto,
  UpdateCharacterClassDto,
} from './character-class.dto';

@Injectable()
export class CharacterClassService {
  constructor(
    @InjectRepository(CharacterClass)
    private characterClassRepository: Repository<CharacterClass>,
    @InjectRepository(CharacterAdvancement)
    private characterAdvancementRepository: Repository<CharacterAdvancement>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserStat)
    private userStatRepository: Repository<UserStat>,
    @InjectRepository(CombatResult)
    private combatResultRepository: Repository<CombatResult>,
    @InjectRepository(UserItem)
    private userItemRepository: Repository<UserItem>,
    private questService: QuestService,
    private dataSource: DataSource,
  ) {}

  async createClass(
    dto: CreateCharacterClassDto,
  ): Promise<CharacterClassResponseDto> {
    const characterClass = this.characterClassRepository.create(dto);
    const savedClass = await this.characterClassRepository.save(characterClass);
    return this.mapToResponseDto(savedClass);
  }

  async getAllClasses(): Promise<CharacterClassResponseDto[]> {
    const classes = await this.characterClassRepository.find({
      relations: ['previousClass'],
      order: { tier: 'ASC', type: 'ASC' },
    });
    return classes.map((cls) => this.mapToResponseDto(cls));
  }

  async getClassesByTier(
    tier: ClassTier,
  ): Promise<CharacterClassResponseDto[]> {
    const classes = await this.characterClassRepository.find({
      where: { tier },
      relations: ['previousClass'],
      order: { type: 'ASC' },
    });
    return classes.map((cls) => this.mapToResponseDto(cls));
  }

  async getAvailableAdvancements(
    userId: number,
  ): Promise<AdvancementCheckResultDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['characterClass'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userStats = await this.userStatRepository.findOne({
      where: { userId },
    });

    if (!userStats) {
      throw new NotFoundException('User stats not found');
    }

    const currentTier = user.characterClass?.tier || ClassTier.BASIC;
    const nextTier = currentTier + 1;

    if (nextTier > ClassTier.LEGENDARY) {
      return {
        canAdvance: false,
        missingRequirements: {},
        availableClasses: [],
      };
    }

    // Get available classes for next tier
    const availableClasses = await this.characterClassRepository.find({
      where: { tier: nextTier },
      relations: ['previousClass'],
    });

    // Filter classes that can be advanced from current class
    const validClasses = availableClasses.filter(
      (cls) =>
        !cls.previousClassId || cls.previousClassId === user.characterClass?.id,
    );

    const checkResults = await Promise.all(
      validClasses.map((cls) =>
        this.checkAdvancementRequirements(userId, cls.id, userStats),
      ),
    );

    const availableClassesFiltered = validClasses.filter(
      (_, index) => checkResults[index].canAdvance,
    );

    return {
      canAdvance: availableClassesFiltered.length > 0,
      missingRequirements:
        checkResults.find((result) => !result.canAdvance)
          ?.missingRequirements || {},
      availableClasses: availableClassesFiltered.map((cls) =>
        this.mapToResponseDto(cls),
      ),
    };
  }

  private async checkAdvancementRequirements(
    userId: number,
    targetClassId: number,
    userStats: UserStat,
  ): Promise<{ canAdvance: boolean; missingRequirements: any }> {
    const targetClass = await this.characterClassRepository.findOne({
      where: { id: targetClassId },
    });

    if (!targetClass) {
      throw new NotFoundException('Target class not found');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const missingRequirements: any = {};

    // Check level requirement
    if (user.level < targetClass.requiredLevel) {
      missingRequirements.level = targetClass.requiredLevel;
    }

    // Check advancement requirements if any
    if (targetClass.advancementRequirements) {
      // Check dungeon completions
      if (targetClass.advancementRequirements.dungeons) {
        const missingDungeons: any[] = [];
        for (const dungeon of targetClass.advancementRequirements.dungeons) {
          // Check dungeon completion count
          const dungeonCompletions = await this.combatResultRepository.count({
            where: {
              dungeonId: dungeon.dungeonId,
              result: CombatResultType.VICTORY,
            },
          });

          // Filter results where user is in the userIds array
          const userDungeonResults = await this.combatResultRepository.find({
            where: {
              dungeonId: dungeon.dungeonId,
              result: CombatResultType.VICTORY,
            },
          });

          const userCompletions = userDungeonResults.filter((result) =>
            result.userIds.includes(userId),
          ).length;

          if (userCompletions < dungeon.requiredCompletions) {
            missingDungeons.push({
              dungeonId: dungeon.dungeonId,
              dungeonName: dungeon.dungeonName,
              required: dungeon.requiredCompletions,
              current: userCompletions,
            });
          }
        }
        if (missingDungeons.length > 0) {
          missingRequirements.dungeons = missingDungeons;
        }
      }

      // Check quest completions
      if (targetClass.advancementRequirements.quests) {
        const missingQuests: any[] = [];
        for (const quest of targetClass.advancementRequirements.quests) {
          // Check if quest is completed by user
          const isQuestCompleted = await this.questService.isQuestCompleted(
            userId,
            quest.questId,
          );

          if (!isQuestCompleted) {
            missingQuests.push({
              questId: quest.questId,
              questName: quest.questName,
            });
          }
        }
        if (missingQuests.length > 0) {
          missingRequirements.quests = missingQuests;
        }
      }

      // Check item requirements
      if (targetClass.advancementRequirements.items) {
        const missingItems: any[] = [];
        for (const item of targetClass.advancementRequirements.items) {
          // Check user inventory for required items
          const userItem = await this.userItemRepository.findOne({
            where: {
              userId: userId,
              itemId: item.itemId,
            },
          });

          const currentQuantity = userItem?.quantity || 0;

          if (currentQuantity < item.quantity) {
            missingItems.push({
              itemId: item.itemId,
              itemName: item.itemName,
              required: item.quantity,
              current: currentQuantity,
            });
          }
        }
        if (missingItems.length > 0) {
          missingRequirements.items = missingItems;
        }
      }
    }

    const canAdvance = Object.keys(missingRequirements).length === 0;

    return {
      canAdvance,
      missingRequirements,
    };
  }

  async performAdvancement(
    dto: PerformAdvancementDto,
  ): Promise<AdvancementResultDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, {
        where: { id: dto.userId },
        relations: ['characterClass'],
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const userStats = await queryRunner.manager.findOne(UserStat, {
        where: { userId: dto.userId },
      });

      if (!userStats) {
        throw new NotFoundException('User stats not found');
      }

      const targetClass = await queryRunner.manager.findOne(CharacterClass, {
        where: { id: dto.targetClassId },
      });

      if (!targetClass) {
        throw new NotFoundException('Target class not found');
      }

      // Check if advancement is allowed
      const checkResult = await this.checkAdvancementRequirements(
        dto.userId,
        dto.targetClassId,
        userStats,
      );

      if (!checkResult.canAdvance) {
        throw new BadRequestException(
          'Advancement requirements not met',
          checkResult.missingRequirements,
        );
      }

      // Consume required items
      if (targetClass.advancementRequirements?.items) {
        for (const item of targetClass.advancementRequirements.items) {
          const userItem = await queryRunner.manager.findOne(UserItem, {
            where: {
              userId: dto.userId,
              itemId: item.itemId,
            },
          });

          if (!userItem || userItem.quantity < item.quantity) {
            throw new BadRequestException(
              `Insufficient quantity of item ${item.itemName}`,
            );
          }

          userItem.quantity -= item.quantity;

          if (userItem.quantity <= 0) {
            await queryRunner.manager.remove(userItem);
          } else {
            await queryRunner.manager.save(userItem);
          }
        }
      }

      // Calculate stat changes
      const oldStats = user.characterClass?.statBonuses || {};
      const newStats = targetClass.statBonuses;
      const statChanges = {
        strength: (newStats.strength || 0) - (oldStats.strength || 0),
        intelligence:
          (newStats.intelligence || 0) - (oldStats.intelligence || 0),
        dexterity: (newStats.dexterity || 0) - (oldStats.dexterity || 0),
        vitality: (newStats.vitality || 0) - (oldStats.vitality || 0),
        luck: (newStats.luck || 0) - (oldStats.luck || 0),
        critRate: (newStats.critRate || 0) - (oldStats.critRate || 0),
        critDamage: (newStats.critDamage || 0) - (oldStats.critDamage || 0),
        comboRate: (newStats.comboRate || 0) - (oldStats.comboRate || 0),
        counterRate: (newStats.counterRate || 0) - (oldStats.counterRate || 0),
        lifesteal: (newStats.lifesteal || 0) - (oldStats.lifesteal || 0),
        armorPen: (newStats.armorPen || 0) - (oldStats.armorPen || 0),
        dodgeRate: (newStats.dodgeRate || 0) - (oldStats.dodgeRate || 0),
        accuracy: (newStats.accuracy || 0) - (oldStats.accuracy || 0),
      };

      // Update user class
      user.characterClass = targetClass;
      await queryRunner.manager.save(user);

      // Update user stats with class bonuses
      userStats.strength += statChanges.strength;
      userStats.intelligence += statChanges.intelligence;
      userStats.dexterity += statChanges.dexterity;
      userStats.vitality += statChanges.vitality;
      userStats.luck += statChanges.luck;

      // Update advanced stats
      userStats.critRate += statChanges.critRate;
      userStats.critDamage += statChanges.critDamage;
      userStats.comboRate += statChanges.comboRate;
      userStats.counterRate += statChanges.counterRate;
      userStats.lifesteal += statChanges.lifesteal;
      userStats.armorPen += statChanges.armorPen;
      userStats.dodgeRate += statChanges.dodgeRate;
      userStats.accuracy += statChanges.accuracy;

      // Recalculate derived stats
      userStats.maxHp = Math.floor(userStats.vitality * 10);
      userStats.attack = Math.floor(userStats.strength * 2);
      userStats.defense = Math.floor(userStats.vitality * 1.5);

      await queryRunner.manager.save(userStats);

      // Create advancement record
      const advancement = queryRunner.manager.create(CharacterAdvancement, {
        userId: dto.userId,
        currentClassId: dto.targetClassId,
        advancementStatus: AdvancementStatus.COMPLETED,
        advancementDate: new Date(),
        completedRequirements: {
          dungeons: targetClass.advancementRequirements?.dungeons || [],
          quests: targetClass.advancementRequirements?.quests || [],
          items: targetClass.advancementRequirements?.items || [],
        },
      });

      await queryRunner.manager.save(advancement);

      await queryRunner.commitTransaction();

      return {
        success: true,
        newClass: this.mapToResponseDto(targetClass),
        statChanges,
        unlockedSkills: targetClass.skillUnlocks,
        message: `Successfully advanced to ${targetClass.name}!`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getUserAdvancementHistory(
    userId: number,
  ): Promise<CharacterAdvancementResponseDto[]> {
    const advancements = await this.characterAdvancementRepository.find({
      where: { userId },
      relations: ['currentClass'],
      order: { advancementDate: 'DESC' },
    });

    return advancements.map((adv) => this.mapAdvancementToResponseDto(adv));
  }

  async deleteClass(id: number): Promise<void> {
    const characterClass = await this.characterClassRepository.findOne({
      where: { id },
    });

    if (!characterClass) {
      throw new NotFoundException('Character class not found');
    }

    // Check if any users are currently using this class
    const usersUsingClass = await this.userRepository.count({
      where: { characterClass: { id } },
    });

    if (usersUsingClass > 0) {
      throw new BadRequestException(
        'Cannot delete character class that is currently in use by users',
      );
    }

    // Check if any users have this class in their advancement history
    const advancementCount = await this.characterAdvancementRepository.count({
      where: { currentClassId: id },
    });

    if (advancementCount > 0) {
      throw new BadRequestException(
        'Cannot delete character class that has been used in advancement history',
      );
    }

    await this.characterClassRepository.remove(characterClass);
  }

  async updateClass(
    id: number,
    dto: UpdateCharacterClassDto,
  ): Promise<CharacterClassResponseDto> {
    const characterClass = await this.characterClassRepository.findOne({
      where: { id },
    });

    if (!characterClass) {
      throw new NotFoundException('Character class not found');
    }

    // Update the character class with the provided data
    Object.assign(characterClass, dto);

    const updatedClass =
      await this.characterClassRepository.save(characterClass);
    return this.mapToResponseDto(updatedClass);
  }

  private mapToResponseDto(
    characterClass: CharacterClass,
  ): CharacterClassResponseDto {
    return {
      id: characterClass.id,
      name: characterClass.name,
      description: characterClass.description,
      type: characterClass.type,
      tier: characterClass.tier,
      requiredLevel: characterClass.requiredLevel,
      statBonuses: characterClass.statBonuses,
      skillUnlocks: characterClass.skillUnlocks,
      advancementRequirements: characterClass.advancementRequirements,
      previousClassId: characterClass.previousClassId,
      previousClass: characterClass.previousClass
        ? this.mapToResponseDto(characterClass.previousClass)
        : undefined,
      createdAt: characterClass.createdAt,
      updatedAt: characterClass.updatedAt,
    };
  }

  private mapAdvancementToResponseDto(
    advancement: CharacterAdvancement,
  ): CharacterAdvancementResponseDto {
    return {
      id: advancement.id,
      userId: advancement.userId,
      currentClass: this.mapToResponseDto(advancement.currentClass),
      advancementStatus: advancement.advancementStatus,
      completedRequirements: advancement.completedRequirements,
      advancementDate: advancement.advancementDate,
      createdAt: advancement.createdAt,
      updatedAt: advancement.updatedAt,
    };
  }
}
