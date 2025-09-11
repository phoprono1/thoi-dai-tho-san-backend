/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Quest,
  UserQuest,
  QuestStatus,
  QuestCombatTracking,
  QuestType,
} from './quest.entity';
import { UsersService } from '../users/users.service';
import { UserItemsService } from '../user-items/user-items.service';
import { CombatResult } from '../combat-results/combat-result.entity';
import { User } from '../users/user.entity';

@Injectable()
export class QuestService {
  constructor(
    @InjectRepository(Quest)
    private questRepository: Repository<Quest>,
    @InjectRepository(UserQuest)
    private userQuestRepository: Repository<UserQuest>,
    @InjectRepository(QuestCombatTracking)
    private questCombatTrackingRepository: Repository<QuestCombatTracking>,
    @InjectRepository(CombatResult)
    private combatResultRepository: Repository<CombatResult>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly usersService: UsersService,
    private readonly userItemsService: UserItemsService,
  ) {}

  async createQuest(questData: Partial<Quest>): Promise<Quest> {
    const quest = this.questRepository.create(questData);
    const savedQuest = await this.questRepository.save(quest);

    // Auto-assign quest to all users
    await this.assignQuestToAllUsers(savedQuest.id);

    return savedQuest;
  }

  async getAllQuests(): Promise<Quest[]> {
    return this.questRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getQuestById(id: number): Promise<Quest | null> {
    return this.questRepository.findOne({ where: { id } });
  }

  async getUserQuests(userId: number): Promise<UserQuest[]> {
    return this.userQuestRepository.find({
      where: { userId },
      relations: ['quest'],
      order: { createdAt: 'DESC' },
    });
  }

  async startQuest(userId: number, questId: number): Promise<UserQuest> {
    const existingUserQuest = await this.userQuestRepository.findOne({
      where: { userId, questId },
    });

    // Load quest and user to validate requirements before starting
    const quest = await this.getQuestById(questId);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const userLevel = user?.level || 0;

    if (quest) {
      // Check user's level against quest.requiredLevel
      if (quest.requiredLevel && userLevel < quest.requiredLevel) {
        throw new Error('User level too low to start this quest');
      }

      // Check quest dependencies (prerequisite quests, dependency level, etc.)
      const depsOk = await this.checkQuestDependencies(userId, questId);
      if (!depsOk) {
        throw new Error('Quest dependencies not satisfied');
      }
    }

    if (existingUserQuest) {
      if (existingUserQuest.status === QuestStatus.COMPLETED) {
        throw new Error('Quest already completed');
      }

      // If the quest was available, mark it as in-progress when the user starts it
      if (existingUserQuest.status === QuestStatus.AVAILABLE) {
        existingUserQuest.status = QuestStatus.IN_PROGRESS;
        existingUserQuest.startedAt = new Date();
        // ensure progress object exists
        existingUserQuest.progress = existingUserQuest.progress || {};
        return this.userQuestRepository.save(existingUserQuest);
      }

      // If it's already in progress, just return it
      return existingUserQuest;
    }

    const userQuest = this.userQuestRepository.create({
      userId,
      questId,
      status: QuestStatus.IN_PROGRESS,
      startedAt: new Date(),
      progress: {},
    });

    return this.userQuestRepository.save(userQuest);
  }

  async checkQuestCompletion(
    userId: number,
    questId: number,
  ): Promise<boolean> {
    const userQuest = await this.userQuestRepository.findOne({
      where: { userId, questId },
      relations: ['quest'],
    });

    if (!userQuest || userQuest.status !== QuestStatus.IN_PROGRESS) {
      return false;
    }

    // Get quest separately since we don't have relation
    const quest = await this.getQuestById(userQuest.questId);
    if (!quest) {
      return false;
    }

    // Load user to validate level-based requirements
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const userLevel = user?.level || 0;

    const progress = userQuest.progress || {};

    // Check all requirements
    let allCompleted = true;

    // Check level requirement
    if (quest.requirements.reachLevel) {
      // Either the recorded progress or the user's current level satisfies this
      const currentLevelProgress = progress.currentLevel || 0;
      if (
        currentLevelProgress < quest.requirements.reachLevel &&
        userLevel < quest.requirements.reachLevel
      ) {
        allCompleted = false;
      }
    }

    // Check enemy kills
    if (quest.requirements.killEnemies) {
      for (const enemyReq of quest.requirements.killEnemies) {
        const enemyProgress = progress.killEnemies?.find(
          (p) => p.enemyType === enemyReq.enemyType,
        );
        if (!enemyProgress || enemyProgress.current < enemyReq.count) {
          allCompleted = false;
          break;
        }
      }
    }

    // Check item collection.
    // If the recorded progress doesn't show collected items, also
    // consult the user's inventory so that pressing "Check" can
    // complete a collect-items quest when the player already holds
    // the required items but progress hasn't been updated client-side.
    if (quest.requirements.collectItems) {
      for (const itemReq of quest.requirements.collectItems) {
        const itemProgress = progress.collectItems?.find(
          (p) => p.itemId === itemReq.itemId,
        );

        // If progress satisfies the requirement, continue
        if (itemProgress && itemProgress.current >= itemReq.quantity) {
          continue;
        }

        // Otherwise, check the user's inventory directly
        try {
          const userItem = await this.userItemsService.findByUserAndItem(
            userId,
            Number(itemReq.itemId),
          );
          const haveQty = userItem?.quantity || 0;
          if (haveQty >= Number(itemReq.quantity)) {
            // Inventory has enough — treat as satisfied (deduction will occur later)
            continue;
          }
        } catch {
          // fall through to mark incomplete
        }

        allCompleted = false;
        break;
      }
    }

    // Check dungeon completions
    if (quest.requirements.completeDungeons) {
      for (const dungeonReq of quest.requirements.completeDungeons) {
        const dungeonProgress = progress.completeDungeons?.find(
          (p) => p.dungeonId === dungeonReq.dungeonId,
        );
        if (!dungeonProgress || dungeonProgress.current < dungeonReq.count) {
          allCompleted = false;
          break;
        }
      }
    }

    // Check boss defeat
    if (quest.requirements.defeatBoss) {
      if (!progress.defeatedBoss) {
        allCompleted = false;
      }
    }

    if (allCompleted) {
      // If quest requires collected items, verify user actually has them
      // and deduct them before marking completed. If any required item
      // is missing or insufficient, abort completion.
      if (
        quest.requirements?.collectItems &&
        quest.requirements.collectItems.length > 0
      ) {
        const missing: Array<{
          itemId: number;
          required: number;
          have: number;
        }> = [];

        // First pass: verify all required items exist in user's inventory
        for (const itemReq of quest.requirements.collectItems) {
          try {
            const userItem = await this.userItemsService.findByUserAndItem(
              userId,
              Number(itemReq.itemId),
            );
            const haveQty = userItem?.quantity || 0;
            if (haveQty < Number(itemReq.quantity)) {
              missing.push({
                itemId: Number(itemReq.itemId),
                required: Number(itemReq.quantity),
                have: haveQty,
              });
            }
          } catch {
            // Treat errors as missing items
            missing.push({
              itemId: Number(itemReq.itemId),
              required: Number(itemReq.quantity),
              have: 0,
            });
          }
        }

        if (missing.length > 0) {
          // Do not mark quest completed if any required item is missing
          // Additionally fetch and log the full user inventory to aid debugging
          try {
            const inventory = await this.userItemsService.findByUserId(userId);
            console.warn(
              'Quest completion aborted: user missing required items',
              {
                userId,
                questId,
                missing,
                inventory,
                progress,
                requirements: quest.requirements,
              },
            );
          } catch {
            console.warn(
              'Quest completion aborted: missing items (and failed to read inventory)',
              {
                userId,
                questId,
                missing,
                progress,
                requirements: quest.requirements,
              },
            );
          }
          return false;
        }

        // Second pass: deduct required items from user inventory
        for (const itemReq of quest.requirements.collectItems) {
          try {
            const removed = await this.userItemsService.removeItemFromUser(
              userId,
              Number(itemReq.itemId),
              Number(itemReq.quantity),
            );
            if (!removed) {
              // If removal failed for any reason, abort completion (no transactional rollback here)
              console.error(
                'Failed to remove required quest items for completion',
                {
                  userId,
                  questId,
                  itemId: itemReq.itemId,
                  quantity: itemReq.quantity,
                },
              );
              return false;
            }
          } catch (error) {
            console.error(
              'Error removing required quest item during completion',
              error,
            );
            return false;
          }
        }
      }

      // Mark as completed and persist
      userQuest.status = QuestStatus.COMPLETED;
      userQuest.completedAt = new Date();
      userQuest.completionCount = (userQuest.completionCount || 0) + 1;
      await this.userQuestRepository.save(userQuest);

      // Apply rewards to the user (experience, gold, items)
      try {
        const q = await this.getQuestById(userQuest.questId);
        if (q) {
          await this.applyQuestRewards(userId, q);
        }
      } catch (err) {
        // Do not block completion if reward application fails; log and continue
        console.error(
          'Error applying quest rewards:',
          err instanceof Error ? err.message : err,
        );
      }
    }

    return allCompleted;
  }

  /**
   * API-friendly wrapper that runs the completion check (which may
   * deduct items and mark the quest completed) and returns the
   * resulting status plus authoritative updated objects for the UI.
   */
  async checkQuestCompletionForApi(
    userId: number,
    questId: number,
  ): Promise<{
    completed: boolean;
    userQuest?: UserQuest | null;
    userItems?: any[];
  }> {
    const completed = await this.checkQuestCompletion(userId, questId);

    // Fetch authoritative userQuest and inventory after the potentially
    // state-changing completion logic so the frontend can update immediately.
    const userQuest = await this.userQuestRepository.findOne({
      where: { userId, questId },
      relations: ['quest'],
    });

    let userItems: any[] = [];
    try {
      userItems = await this.userItemsService.findByUserId(userId);
    } catch {
      // ignore inventory fetch errors for API convenience
    }

    return { completed, userQuest, userItems };
  }

  async isQuestCompleted(userId: number, questId: number): Promise<boolean> {
    const userQuest = await this.userQuestRepository.findOne({
      where: { userId, questId },
      relations: ['quest'],
    });

    if (!userQuest || userQuest.status !== QuestStatus.COMPLETED) {
      return false;
    }

    return true;
  }

  async updateQuestProgress(
    userId: number,
    questId: number,
    progressUpdate: any,
  ): Promise<UserQuest> {
    const userQuest = await this.userQuestRepository.findOne({
      where: { userId, questId },
    });

    if (!userQuest) {
      throw new Error('User quest not found');
    }

    const currentProgress = userQuest.progress || {};

    // Merge progress updates
    const updatedProgress = { ...currentProgress, ...progressUpdate };

    userQuest.progress = updatedProgress;
    return this.userQuestRepository.save(userQuest);
  }

  // Check if quest dependencies are met
  async checkQuestDependencies(
    userId: number,
    questId: number,
  ): Promise<boolean> {
    const quest = await this.getQuestById(questId);
    if (!quest || !quest.dependencies?.prerequisiteQuests) {
      return true; // No dependencies
    }

    // Check if all prerequisite quests are completed
    for (const prereqQuestId of quest.dependencies.prerequisiteQuests) {
      const isCompleted = await this.isQuestCompleted(userId, prereqQuestId);
      if (!isCompleted) {
        return false;
      }
    }

    // Also check level dependency if present
    if (quest.dependencies?.requiredLevel) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      const userLevel = user?.level || 0;
      if (userLevel < quest.dependencies.requiredLevel) {
        return false;
      }
    }

    return true;
  }

  // Get available quests for user (considering dependencies)
  async getAvailableQuestsForUser(userId: number): Promise<Quest[]> {
    // Get all user quests with AVAILABLE status
    const userQuests = await this.userQuestRepository.find({
      where: { userId, status: QuestStatus.AVAILABLE },
      relations: ['quest'],
    });

    const availableQuests: Quest[] = [];

    for (const userQuest of userQuests) {
      const quest = userQuest.quest;

      // Check dependencies
      const dependenciesMet = await this.checkQuestDependencies(
        userId,
        quest.id,
      );

      if (dependenciesMet) {
        // For daily quests, check if needs reset
        if (quest.type === QuestType.DAILY) {
          const today = new Date().toDateString();
          if (userQuest?.lastResetDate?.toDateString() !== today) {
            // Reset daily quest
            await this.resetDailyQuest(userId, quest.id);
          }
        }

        availableQuests.push(quest);
      }
    }

    return availableQuests;
  }

  // Reset daily quests
  async resetDailyQuest(userId: number, questId: number): Promise<void> {
    const userQuest = await this.userQuestRepository.findOne({
      where: { userId, questId },
    });

    if (userQuest) {
      userQuest.status = QuestStatus.AVAILABLE;
      userQuest.progress = {};
      userQuest.lastResetDate = new Date();
      await this.userQuestRepository.save(userQuest);
    }
  }

  // Reset all daily quests for user
  async resetAllDailyQuestsForUser(userId: number): Promise<void> {
    const dailyQuests = await this.questRepository.find({
      where: { type: QuestType.DAILY, isActive: true },
    });

    for (const quest of dailyQuests) {
      await this.resetDailyQuest(userId, quest.id);
    }
  }

  // Handle coop quest progress from combat results
  async updateQuestProgressFromCombat(
    userId: number,
    combatResultId: number,
    combatData: {
      dungeonId?: number;
      enemyKills?: { enemyType: string; count: number }[];
      bossDefeated?: boolean;
    },
  ): Promise<void> {
    // Check if this combat result was already processed for quests
    const existingTracking = await this.questCombatTrackingRepository.findOne({
      where: { userId, combatResultId },
    });

    if (existingTracking?.questProgressUpdated) {
      return; // Already processed
    }

    // Load the combat result so we can compare timestamps and dungeon
    const combatResult = await this.combatResultRepository.findOne({
      where: { id: combatResultId },
    });

    if (!combatResult) {
      // If there's no combat record we can't safely attribute progress
      return;
    }

    const combatCreatedAt = combatResult.createdAt;

    // Get user's active quests
    const userQuests = await this.userQuestRepository.find({
      where: { userId, status: QuestStatus.IN_PROGRESS },
      relations: ['quest'],
    });

    for (const userQuest of userQuests) {
      // If the user started the quest after this combat occurred, skip it
      if (
        userQuest.startedAt &&
        combatCreatedAt &&
        combatCreatedAt < userQuest.startedAt
      ) {
        // combat predates quest start, don't count it
        continue;
      }
      const quest = await this.getQuestById(userQuest.questId);
      if (!quest) continue;

      let progressUpdated = false;

      // Update dungeon completion progress
      if (combatData.dungeonId && quest.requirements.completeDungeons) {
        for (const dungeonReq of quest.requirements.completeDungeons) {
          if (dungeonReq.dungeonId === combatData.dungeonId) {
            const currentProgress = userQuest.progress?.completeDungeons || [];
            const existingProgress = currentProgress.find(
              (p) => p.dungeonId === dungeonReq.dungeonId,
            );

            if (existingProgress) {
              existingProgress.current += 1;
            } else {
              currentProgress.push({
                dungeonId: dungeonReq.dungeonId,
                current: 1,
                required: dungeonReq.count,
              });
            }

            userQuest.progress = {
              ...userQuest.progress,
              completeDungeons: currentProgress,
            };
            progressUpdated = true;
          }
        }
      }

      // Update enemy kill progress
      if (combatData.enemyKills && quest.requirements.killEnemies) {
        const currentProgress = userQuest.progress?.killEnemies || [];

        for (const kill of combatData.enemyKills) {
          for (const enemyReq of quest.requirements.killEnemies) {
            if (enemyReq.enemyType === kill.enemyType) {
              const existingProgress = currentProgress.find(
                (p) => p.enemyType === kill.enemyType,
              );

              if (existingProgress) {
                existingProgress.current += kill.count;
              } else {
                currentProgress.push({
                  enemyType: kill.enemyType,
                  current: kill.count,
                  required: enemyReq.count,
                });
              }
              progressUpdated = true;
            }
          }
        }

        if (progressUpdated) {
          userQuest.progress = {
            ...userQuest.progress,
            killEnemies: currentProgress,
          };
        }
      }

      // Update boss defeat progress
      if (combatData.bossDefeated && quest.requirements.defeatBoss) {
        userQuest.progress = {
          ...userQuest.progress,
          defeatedBoss: true,
        };
        progressUpdated = true;
      }

      if (progressUpdated) {
        await this.userQuestRepository.save(userQuest);

        // Mark combat result as processed for this quest
        await this.questCombatTrackingRepository.save({
          userId,
          questId: quest.id,
          combatResultId,
          combatCompletedAt: new Date(),
          questProgressUpdated: true,
        });

        // Check if quest is now completed
        await this.checkQuestCompletion(userId, quest.id);
      }
    }
  }

  // Get quest progress summary for user
  async getQuestProgressSummary(userId: number): Promise<{
    totalQuests: number;
    completedQuests: number;
    inProgressQuests: number;
    availableQuests: number;
    dailyQuestsCompleted: number;
  }> {
    const allUserQuests = await this.getUserQuests(userId);
    const availableQuests = await this.getAvailableQuestsForUser(userId);

    const completedQuests = allUserQuests.filter(
      (uq) => uq.status === QuestStatus.COMPLETED,
    ).length;

    const inProgressQuests = allUserQuests.filter(
      (uq) => uq.status === QuestStatus.IN_PROGRESS,
    ).length;

    const dailyQuestsCompleted = allUserQuests.filter(
      (uq) =>
        uq.status === QuestStatus.COMPLETED &&
        uq.questId &&
        uq.questId.toString().includes('daily'),
    ).length;

    return {
      totalQuests: allUserQuests.length,
      completedQuests,
      inProgressQuests,
      availableQuests: availableQuests.length,
      dailyQuestsCompleted,
    };
  }

  async updateQuest(id: number, questData: Partial<Quest>): Promise<Quest> {
    await this.questRepository.update(id, questData);
    const updatedQuest = await this.getQuestById(id);
    if (!updatedQuest) {
      throw new Error('Quest not found');
    }
    return updatedQuest;
  }

  async deleteQuest(id: number): Promise<void> {
    const result = await this.questRepository.delete(id);
    if (result.affected === 0) {
      throw new Error('Quest not found');
    }
  }

  // Auto-assign quest to all users when created
  private async assignQuestToAllUsers(questId: number): Promise<void> {
    const allUsers = await this.userRepository.find({
      select: ['id'],
    });

    const userQuests = allUsers.map((user) => ({
      userId: user.id,
      questId,
      status: QuestStatus.AVAILABLE,
      progress: {},
    }));

    if (userQuests.length > 0) {
      await this.userQuestRepository.save(userQuests);
    }
  }

  // Apply quest rewards to a user: XP and gold directly, items via UserItemsService
  private async applyQuestRewards(userId: number, quest: Quest): Promise<void> {
    if (!quest.rewards) return;

    // Apply experience and gold directly on user
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) return;

      const exp = Number(quest.rewards.experience || 0) || 0;
      const gold = Number(quest.rewards.gold || 0) || 0;

      if (exp > 0) {
        user.experience = (user.experience || 0) + exp;
      }
      if (gold > 0) {
        user.gold = (user.gold || 0) + gold;
      }

      await this.userRepository.save(user);

      // If experience changed, attempt level up (non-blocking)
      if (exp > 0) {
        try {
          await this.usersService.levelUpUser(userId);
        } catch {
          // ignore: not enough exp or other level-up constraints
        }
      }

      // Apply item rewards via UserItemsService
      if (quest.rewards.items && quest.rewards.items.length > 0) {
        for (const it of quest.rewards.items) {
          const itemId = Number((it as any).itemId);
          const qty = Number((it as any).quantity) || 1;
          if (!Number.isNaN(itemId)) {
            try {
              await this.userItemsService.addItemToUser(userId, itemId, qty);
            } catch (err) {
              console.error(
                'Error adding quest item reward:',
                err instanceof Error ? err.message : err,
              );
            }
          }
        }
      }
    } catch (err) {
      console.error(
        'Error applying quest rewards (outer):',
        err instanceof Error ? err.message : err,
      );
    }
  }
}
