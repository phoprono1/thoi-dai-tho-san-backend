/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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
import { CharacterClassAdvancement } from './character-class-advancement.entity';
import { PendingAdvancement } from './pending-advancement.entity';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import {
  CombatResult,
  CombatResultType,
} from '../combat-results/combat-result.entity';
import { UserItem } from '../user-items/user-item.entity';
import { QuestService } from '../quests/quest.service';
import { UserStatsService } from '../user-stats/user-stats.service';
import { CharacterClassHistory } from './character-class-history.entity';
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
    @InjectRepository(CharacterClassAdvancement)
    private characterClassAdvancementRepository: Repository<CharacterClassAdvancement>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserStat)
    private userStatRepository: Repository<UserStat>,
    @InjectRepository(CombatResult)
    private combatResultRepository: Repository<CombatResult>,
    @InjectRepository(UserItem)
    private userItemRepository: Repository<UserItem>,
    @InjectRepository(CharacterClassHistory)
    private characterClassHistoryRepository: Repository<CharacterClassHistory>,
    @InjectRepository(PendingAdvancement)
    private pendingAdvancementRepository: Repository<PendingAdvancement>,
    private dataSource: DataSource,
    private questService: QuestService,
    private userStatsService: UserStatsService,
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
    if (currentTier >= ClassTier.GODLIKE) {
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

    // For each valid next-tier class, find the admin-configured mapping (if any)
    // and run requirement checks. We return a `candidates` array containing
    // mapping metadata and requirement diagnostics so the client can show
    // choosable options even when requirements are not yet met. Hidden/random
    // mappings (allowPlayerChoice=false) will NOT be included in the
    // `availableClasses` list that the player UI uses to render choices.
    const candidates = await Promise.all(
      validClasses.map(async (cls) => {
        const mapping = await this.characterClassAdvancementRepository.findOne({
          where: {
            fromClassId: user.characterClass?.id || null,
            toClassId: cls.id,
          },
        });

        // If there's no mapping, treat as not available for players
        if (!mapping) {
          return {
            class: this.mapToResponseDto(cls),
            mapping: null,
            canAdvance: false,
            missingRequirements: {
              path: {
                message: `No advancement path found from class ${user.characterClass?.id || 'none'} to class ${cls.id}`,
                fromClassId: user.characterClass?.id || null,
                toClassId: cls.id,
              },
            },
          };
        }

        const check = await this.checkAdvancementRequirements(userId, cls.id);

        return {
          class: this.mapToResponseDto(cls),
          mapping,
          canAdvance: check.canAdvance,
          missingRequirements: check.missingRequirements,
        };
      }),
    );

    // Player-visible classes are those where the admin mapping allows player choice
    const playerVisible = candidates
      .filter((c) => c.mapping && c.mapping.allowPlayerChoice)
      .map((c) => c.class);

    // Determine if any player-visible option is immediately advanceable
    const anyCanAdvance = candidates.some(
      (c) => c.mapping && c.mapping.allowPlayerChoice && c.canAdvance,
    );

    // Pick first non-advanceable player-visible missingRequirements for diagnostics
    const firstMissing = candidates.find(
      (c) => c.mapping && c.mapping.allowPlayerChoice && !c.canAdvance,
    );

    return {
      canAdvance: anyCanAdvance,
      missingRequirements: firstMissing?.missingRequirements || {},
      availableClasses: playerVisible,
      candidates,
    };
  }

  public async checkAdvancementRequirements(
    userId: number,
    targetClassId: number,
  ): Promise<AdvancementCheckResultDto> {
    // Basic sanity checks
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

    const targetClass = await this.characterClassRepository.findOne({
      where: { id: targetClassId },
    });
    if (!targetClass) {
      throw new NotFoundException('Target class not found');
    }

    const missingRequirements: Record<string, unknown> = {};

    console.log(
      `Checking advancement requirements for userId=${userId}, targetClassId=${targetClassId}`,
    );

    // Check advancement path (admin-configured mapping)
    const advancementPath =
      await this.characterClassAdvancementRepository.findOne({
        where: {
          fromClassId: user.characterClass?.id || null,
          toClassId: targetClassId,
        },
      });

    // If no explicit advancement mapping exists, return a negative result
    // instead of throwing. Clients can then show friendly diagnostics.
    if (!advancementPath) {
      missingRequirements.path = {
        message: `No advancement path found from class ${user.characterClass?.id || 'none'} to class ${targetClassId}`,
        fromClassId: user.characterClass?.id || null,
        toClassId: targetClassId,
      };

      return {
        canAdvance: false,
        missingRequirements,
        availableClasses: [],
      };
    }

    console.log(`Advancement path found:`, {
      id: advancementPath.id,
      fromClassId: advancementPath.fromClassId,
      toClassId: advancementPath.toClassId,
      requirements: JSON.stringify(advancementPath.requirements, null, 2),
    });

    // Check advancement path specific requirements
    if (advancementPath.requirements) {
      // Items
      if (advancementPath.requirements.items) {
        const missingItems: any[] = [];
        for (const itemReq of advancementPath.requirements.items) {
          const userItems = await this.userItemRepository.find({
            where: { userId, itemId: itemReq.itemId },
          });
          const totalQuantity = userItems.reduce(
            (sum, item) => sum + item.quantity,
            0,
          );
          if (totalQuantity < itemReq.quantity) {
            missingItems.push({
              itemId: itemReq.itemId,
              itemName: itemReq.itemName,
              required: itemReq.quantity,
              current: totalQuantity,
            });
          }
        }
        if (missingItems.length > 0) missingRequirements.items = missingItems;
      }

      // Quests
      if (advancementPath.requirements.quests) {
        const missingQuests: any[] = [];
        for (const questReq of advancementPath.requirements.quests) {
          const isCompleted = await this.questService.isQuestCompleted(
            userId,
            Number(questReq.questId),
          );
          if (!isCompleted) {
            missingQuests.push({
              questId: Number(questReq.questId),
              questName: questReq.questName,
              status: 'not_completed',
            });
          }
        }
        if (missingQuests.length > 0) {
          missingRequirements.quests = missingQuests;
        }
      }

      // Dungeons
      if (advancementPath.requirements.dungeons) {
        const missingDungeons: any[] = [];
        for (const dungeonReq of advancementPath.requirements.dungeons) {
          const userDungeonResults = await this.combatResultRepository.find({
            where: {
              dungeonId: dungeonReq.dungeonId,
              result: CombatResultType.VICTORY,
            },
          });

          const userCompletions = userDungeonResults.filter(
            (result) => result.userIds && result.userIds.includes(userId),
          ).length;

          if (userCompletions < dungeonReq.requiredCompletions) {
            missingDungeons.push({
              dungeonId: dungeonReq.dungeonId,
              dungeonName: dungeonReq.dungeonName,
              required: dungeonReq.requiredCompletions,
              current: userCompletions,
            });
          }
        }
        if (missingDungeons.length > 0) {
          missingRequirements.dungeons = missingDungeons;
        }
      }

      // Stats
      if (advancementPath.requirements.stats?.minTotalStats) {
        const us = await this.userStatRepository.findOne({ where: { userId } });
        if (us) {
          const totalStats =
            us.strength +
            us.intelligence +
            us.dexterity +
            us.vitality +
            us.luck;
          if (totalStats < advancementPath.requirements.stats.minTotalStats) {
            missingRequirements.stats = {
              required: advancementPath.requirements.stats.minTotalStats,
              current: totalStats,
            };
          }
        }
      }
    }

    // Check level requirement from target class
    if (user.level < targetClass.requiredLevel) {
      missingRequirements.level = targetClass.requiredLevel;
    }

    // Check target class's built-in advancementRequirements (dungeons/quests/items)
    if (targetClass.advancementRequirements) {
      // Dungeons
      if (targetClass.advancementRequirements.dungeons) {
        const missingDungeons: any[] = [];
        for (const dungeon of targetClass.advancementRequirements.dungeons) {
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

      // Quests
      if (targetClass.advancementRequirements.quests) {
        const missingQuests: any[] = [];
        for (const quest of targetClass.advancementRequirements.quests) {
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

      // Items
      if (targetClass.advancementRequirements.items) {
        const missingItems: any[] = [];
        for (const item of targetClass.advancementRequirements.items) {
          const userItem = await this.userItemRepository.findOne({
            where: { userId: userId, itemId: item.itemId },
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
        if (missingItems.length > 0) missingRequirements.items = missingItems;
      }
    }

    const canAdvance = Object.keys(missingRequirements).length === 0;

    return {
      canAdvance,
      missingRequirements,
      availableClasses: [],
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
        throw new BadRequestException({
          message: 'Advancement requirements not met',
          missingRequirements: checkResult.missingRequirements,
        });
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

      // Calculate stat changes (core attribute bonuses only)
      const newStats = targetClass.statBonuses;
      const statChanges = {
        strength: newStats.strength || 0,
        intelligence: newStats.intelligence || 0,
        dexterity: newStats.dexterity || 0,
        vitality: newStats.vitality || 0,
        luck: newStats.luck || 0,
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

      // Stats are now calculated on-demand from core attributes, no need to recompute

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

    // Build a PerformAdvancementDto and use special awaken advancement (bypass path check)
    const dto: PerformAdvancementDto = {
      userId,
      targetClassId: chosen.id,
    } as PerformAdvancementDto;

    return this.performAwakenAdvancement(dto);
  }

  /**
   * Special advancement method for awaken (first class selection)
   * Bypasses advancement path requirements since awaken is random selection from tier 1
   */
  async performAwakenAdvancement(
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

      // ✅ For awaken: User should NOT have a class
      if (user.characterClass) {
        throw new BadRequestException('User already has a class');
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

      // ✅ For awaken: Only check basic requirements (level, tier 1)
      if (targetClass.tier !== ClassTier.BASIC) {
        throw new BadRequestException('Awaken can only select Tier 1 classes');
      }

      if (user.level < targetClass.requiredLevel) {
        throw new BadRequestException(
          `User level ${user.level} is below required level ${targetClass.requiredLevel}`,
        );
      }

      // Set user's character class
      user.characterClass = targetClass;
      await queryRunner.manager.save(user);

      // Record class history
      const classHistory = queryRunner.manager.create(CharacterClassHistory, {
        characterId: dto.userId,
        previousClassId: null, // First class
        newClassId: dto.targetClassId,
        reason: 'awakening',
        triggeredByUserId: dto.userId,
      });
      await queryRunner.manager.save(classHistory);

      // Create advancement record
      const advancement = queryRunner.manager.create(CharacterAdvancement, {
        userId: dto.userId,
        currentClassId: dto.targetClassId,
        advancementStatus: AdvancementStatus.COMPLETED,
        advancementDate: new Date(),
        completedRequirements: {
          dungeons: [],
          quests: [],
          items: [],
        },
      });

      await queryRunner.manager.save(advancement);

      await queryRunner.commitTransaction();

      return {
        success: true,
        newClass: this.mapToResponseDto(targetClass),
        statChanges: {}, // No stat changes for awaken
        unequippedItemIds: [], // No equipment restrictions for tier 1
        unlockedSkills: [], // No skills for basic awaken
        message: `Thức tỉnh thành công! Bạn đã trở thành ${targetClass.name}`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Special advancement method for pending advancement (from random selection)
   * Bypasses advancement path requirements since it's already been randomly selected
   */
  async performPendingAdvancement(
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

      const targetClass = await queryRunner.manager.findOne(CharacterClass, {
        where: { id: dto.targetClassId },
      });

      if (!targetClass) {
        throw new NotFoundException('Target class not found');
      }

      // Basic level check only (no other requirements for pending advancement)
      if (user.level < targetClass.requiredLevel) {
        throw new BadRequestException(
          `User level ${user.level} is below required level ${targetClass.requiredLevel}`,
        );
      }

      // Store previous class for history
      const previousClassId = user.characterClass?.id || null;

      // Set user's character class
      user.characterClass = targetClass;
      await queryRunner.manager.save(user);

      // Record class history
      const classHistory = queryRunner.manager.create(CharacterClassHistory, {
        characterId: dto.userId,
        previousClassId,
        newClassId: dto.targetClassId,
        reason: 'pending_advancement',
        triggeredByUserId: dto.userId,
      });
      await queryRunner.manager.save(classHistory);

      // Create advancement record
      const advancement = queryRunner.manager.create(CharacterAdvancement, {
        userId: dto.userId,
        currentClassId: dto.targetClassId,
        advancementStatus: AdvancementStatus.COMPLETED,
        advancementDate: new Date(),
        completedRequirements: { dungeons: [], quests: [], items: [] },
      });
      await queryRunner.manager.save(advancement);

      await queryRunner.commitTransaction();

      return {
        success: true,
        newClass: this.mapToResponseDto(targetClass),
        statChanges: {},
        unequippedItemIds: [],
        unlockedSkills: [],
        message: `Thức tỉnh thành công! Bạn đã trở thành ${targetClass.name}`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get pending advancement for user (if any)
   */
  async getPendingAdvancement(userId: number): Promise<any> {
    const pending = await this.pendingAdvancementRepository.findOne({
      where: { userId, status: 'available' },
    });

    if (!pending) return null;

    // Get class details for the options
    const classIds = pending.options.map((opt) => opt.toClassId);
    const classes = await this.characterClassRepository.find({
      where: classIds.map((id) => ({ id })),
    });

    const classMap = classes.reduce(
      (acc, cls) => {
        acc[cls.id] = cls;
        return acc;
      },
      {} as Record<number, any>,
    );

    return {
      id: pending.id,
      options: pending.options.map((opt) => ({
        ...opt,
        classInfo: classMap[opt.toClassId],
      })),
      createdAt: pending.createdAt,
    };
  }

  /**
   * Create pending advancement from random selection
   */
  async createPendingAdvancement(
    userId: number,
    selectedOption: any,
  ): Promise<void> {
    // Clear any existing pending advancement
    await this.pendingAdvancementRepository.delete({ userId });

    // Create new pending advancement
    const pending = this.pendingAdvancementRepository.create({
      userId,
      options: [selectedOption],
      status: 'available',
    });

    await this.pendingAdvancementRepository.save(pending);
  }

  /**
   * Accept pending advancement (perform the actual advancement)
   */
  async acceptPendingAdvancement(userId: number): Promise<any> {
    const pending = await this.pendingAdvancementRepository.findOne({
      where: { userId, status: 'available' },
    });

    if (!pending || pending.options.length === 0) {
      throw new BadRequestException('No pending advancement found');
    }

    const option = pending.options[0];
    // Before performing a pending advancement (e.g. random/secret picks),
    // ensure the user actually meets the advancement requirements for the
    // selected target. Previously pending advancements bypassed the full
    // requirement checks and only enforced a basic level check which made it
    // possible to accept a pending option even when the user hadn't met
    // dungeon/quest/item/stat requirements. That behaviour is unsafe.
    const check = await this.checkAdvancementRequirements(
      userId,
      option.toClassId,
    );
    if (!check.canAdvance) {
      // Return the missing requirements to the caller so the client can
      // display informative feedback and avoid silently accepting.
      throw new BadRequestException({
        message: 'Advancement requirements not met for pending option',
        missingRequirements: check.missingRequirements,
      });
    }

    // Perform the advancement now that requirements are satisfied
    const result = await this.performPendingAdvancement({
      userId,
      targetClassId: option.toClassId,
    });

    // Mark as accepted
    pending.status = 'accepted';
    await this.pendingAdvancementRepository.save(pending);

    return result;
  }

  /**
   * Clear pending advancement
   */
  async clearPendingAdvancement(userId: number): Promise<void> {
    await this.pendingAdvancementRepository.delete({ userId });
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
      // Set users back to null class (they can awaken again)
      await this.userRepository.update(
        { characterClass: { id } },
        { characterClass: null },
      );
      console.log(
        `Reset ${usersUsingClass} users from deleted class ${id} to null (can awaken again)`,
      );
    }

    // Check if any users have this class in their advancement history
    const advancementCount = await this.characterAdvancementRepository.count({
      where: { currentClassId: id },
    });

    if (advancementCount > 0) {
      // Delete advancement history records for this class
      await this.characterAdvancementRepository.delete({
        currentClassId: id,
      });
      console.log(
        `Deleted ${advancementCount} advancement history records for class ${id}`,
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
