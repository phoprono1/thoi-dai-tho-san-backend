/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// CharacterClassService
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
import { UserStatsService } from '../user-stats/user-stats.service';
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
    private userStatsService: UserStatsService,
    private dataSource: DataSource,
  ) {}

  // Optional UserPowerService will be injected by the module when available
  // to allow immediate recompute/persist of user power after class changes.
  private userPowerService?: import('../user-power/user-power.service').UserPowerService;

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

    const currentTier = user.characterClass?.tier ?? ClassTier.BASIC;
    if (currentTier >= ClassTier.LEGENDARY) {
      return {
        canAdvance: false,
        missingRequirements: {},
        availableClasses: [],
      };
    }

    const nextTier = (currentTier + 1) as ClassTier;

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
        this.checkAdvancementRequirements(userId, cls.id),
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

  public async checkAdvancementRequirements(
    userId: number,
    targetClassId: number,
  ): Promise<{
    canAdvance: boolean;
    missingRequirements: Record<string, unknown>;
  }> {
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

    const missingRequirements: Record<string, unknown> = {};

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

      // Calculate stat changes (additive bonuses)
      const newStats = targetClass.statBonuses;
      const statChanges = {
        strength: newStats.strength || 0,
        intelligence: newStats.intelligence || 0,
        dexterity: newStats.dexterity || 0,
        vitality: newStats.vitality || 0,
        luck: newStats.luck || 0,
        critRate: newStats.critRate || 0,
        critDamage: newStats.critDamage || 0,
        comboRate: newStats.comboRate || 0,
        counterRate: newStats.counterRate || 0,
        lifesteal: newStats.lifesteal || 0,
        armorPen: newStats.armorPen || 0,
        dodgeRate: newStats.dodgeRate || 0,
        accuracy: newStats.accuracy || 0,
      };

      // Debug: log stat bonus details to help trace why client doesn't see buffs
      try {
        console.log(
          `performAdvancement user=${dto.userId} targetClass=${targetClass.id}:${targetClass.name}`,
        );
        console.log('newStats:', JSON.stringify(newStats));
        console.log('computed statChanges:', JSON.stringify(statChanges));
      } catch (e) {
        // ignore logging errors
      }

      // Update user class
      user.characterClass = targetClass;
      await queryRunner.manager.save(user);

      // Auto-unequip incompatible items
      const currentlyEquipped: UserItem[] = await queryRunner.manager.find(
        UserItem,
        {
          where: { userId: dto.userId, isEquipped: true },
          relations: ['item'],
        },
      );

      const unequippedIds: number[] = [];
      for (const ui of currentlyEquipped) {
        const item = ui.item as any;
        const classRestrictions = item?.classRestrictions || {};
        let incompatible = false;

        try {
          if (
            classRestrictions.requiredTier &&
            (targetClass.tier as unknown as number) <
              classRestrictions.requiredTier
          ) {
            incompatible = true;
          }

          if (
            Array.isArray(classRestrictions.allowedClassTypes) &&
            classRestrictions.allowedClassTypes.length > 0 &&
            !classRestrictions.allowedClassTypes.includes(targetClass.type)
          ) {
            incompatible = true;
          }

          if (
            Array.isArray(classRestrictions.restrictedClassTypes) &&
            classRestrictions.restrictedClassTypes.length > 0 &&
            classRestrictions.restrictedClassTypes.includes(targetClass.type)
          ) {
            incompatible = true;
          }
        } catch {
          // ignore malformed restriction objects
        }

        if (incompatible) {
          ui.isEquipped = false;
          await queryRunner.manager.save(ui);
          unequippedIds.push(ui.id);
        }
      }

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

      // Recompute stats using centralized service AFTER transaction commit
      // to ensure class bonuses are loaded correctly from the updated user record
      try {
        await this.userStatsService.recomputeAndPersistForUser(dto.userId);
      } catch (e) {
        console.warn(
          'Failed to recompute stats after advancement:',
          e?.message || e,
        );
      }

      // Log the saved userStats row for verification
      try {
        const saved = await this.userStatRepository.findOne({
          where: { userId: dto.userId },
        });
        console.log(
          `Saved userStats for user=${dto.userId}:`,
          JSON.stringify(saved),
        );
      } catch (e) {
        console.warn('Could not read back saved userStats for logging', e);
      }

      return {
        success: true,
        newClass: this.mapToResponseDto(targetClass),
        statChanges,
        unlockedSkills: targetClass.skillUnlocks,
        message: `Successfully advanced to ${targetClass.name}!`,
        unequippedItemIds: unequippedIds,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Server-authoritative awaken: when a user has no class (or is eligible for an initial
   * Tier 1 selection), pick a random Tier 1 class and perform advancement. This is
   * useful for client flows that want a single endpoint to awaken the player.
   */
  public async awaken(userId: number): Promise<AdvancementResultDto> {
    // Find user and determine if they already have a class
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['characterClass'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If the user already has a class, disallow awaken via this endpoint
    if (user.characterClass) {
      // Log for debugging: include class id/name
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      console.warn(
        `Awaken rejected: user ${userId} already has class ${user.characterClass?.id} - ${user.characterClass?.name}`,
      );
      throw new BadRequestException('User already has a class');
    }

    // Fetch all Tier 1 (BASIC) classes
    const tierOneClasses = await this.characterClassRepository.find({
      where: { tier: ClassTier.BASIC },
    });
    if (!tierOneClasses || tierOneClasses.length === 0) {
      throw new NotFoundException('No Tier 1 classes available');
    }

    // Diagnostic logging: show how many candidates we got and their ids
    try {
      // Print the candidate objects (id/name/tier/statBonuses) for easier debugging
      const candidateSummaries = tierOneClasses
        .map((c) => ({
          id: c.id,
          name: c.name,
          tier: c.tier,
          statBonuses: c.statBonuses,
        }))
        .map((c) => JSON.stringify(c))
        .join(', ');

      console.log(
        `Awaken candidates for user ${userId}: [${candidateSummaries}]`,
      );
    } catch {
      // ignore logging errors
    }

    // Choose uniformly at random
    const idx = Math.floor(Math.random() * tierOneClasses.length);
    const chosen = tierOneClasses[idx];

    // Log chosen class
    console.log(
      `Awaken chosen for user ${userId}: ${chosen.id}:${chosen.name} (idx ${idx}/${tierOneClasses.length})`,
    );

    // Build a PerformAdvancementDto and reuse existing performAdvancement for transactional behavior
    const dto: PerformAdvancementDto = {
      userId,
      targetClassId: chosen.id,
    } as PerformAdvancementDto;

    return this.performAdvancement(dto);
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
