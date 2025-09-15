/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
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
import {
  CombatResult,
  CombatResultType,
} from '../combat-results/combat-result.entity';
import { User } from '../users/user.entity';

@Injectable()
export class QuestService {
  private readonly logger = new Logger(QuestService.name);
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
    // Return user quests but omit those that are completed and already
    // had their rewards claimed. This prevents the API from showing
    // quests that the client already claimed (they can still reappear
    // after a full refresh if needed, e.g., daily resets).
    const all = await this.userQuestRepository.find({
      where: { userId },
      relations: ['quest'],
      order: { createdAt: 'DESC' },
    });

    // Ensure the user has rows for all currently active quests (especially
    // daily quests). In some situations (legacy data, manual DB edits, or
    // quest imports) quests may exist but weren't assigned to existing
    // users. Create missing user_quests with AVAILABLE status so the API
    // returns them immediately.
    try {
      const existingQuestIds = new Set(all.map((uq) => uq.questId));
      const missingQuests = await this.questRepository.find({
        where: { isActive: true },
      });

      const toCreate = [] as Partial<UserQuest>[];
      const today = new Date();
      for (const q of missingQuests) {
        if (!existingQuestIds.has(q.id)) {
          toCreate.push({
            userId,
            questId: q.id,
            status: QuestStatus.AVAILABLE,
            progress: {},
            // For daily quests, set lastResetDate to today so they are
            // considered freshly reset; leave null for non-daily quests.
            lastResetDate: q.type === QuestType.DAILY ? today : null,
          });
        }
      }

      if (toCreate.length > 0) {
        const ids = toCreate.map((t) => t.questId).join(',');
        this.logger.debug(
          `Auto-assigning ${toCreate.length} active quests to user ${userId}: questIds=${ids}`,
        );

        // Save in bulk; capture any individual errors and log details
        try {
          const saved = await this.userQuestRepository.save(toCreate as any);
          // Log saved ids and names (if relation loaded afterwards)
          const savedIds = Array.isArray(saved)
            ? saved.map((s) => s.questId || s.id)
            : [saved.questId || saved.id];
          this.logger.debug(
            `Auto-assign succeeded for user ${userId}: savedQuestIds=${savedIds.join(',')}`,
          );
        } catch (saveErr) {
          // Non-fatal — log and continue but include full error info
          this.logger.error(
            `Failed to auto-assign some quests to user ${userId}: ${(saveErr as Error)?.message || String(saveErr)}`,
          );
          try {
            // attempt to save individually to surface which one fails
            for (const t of toCreate) {
              try {
                const single = await this.userQuestRepository.save(t as any);
                this.logger.debug(
                  `Auto-assign single saved for user ${userId}: questId=${single.questId || single.id}`,
                );
              } catch (oneErr) {
                this.logger.error(
                  `Auto-assign single FAILED for user ${userId}: questId=${t.questId}, error=${(oneErr as Error)?.message || String(oneErr)}`,
                );
              }
            }
          } catch (e) {
            this.logger.error(
              'Error during individual auto-assign attempts',
              e as unknown as Error,
            );
          }
        }
      }
    } catch {
      // Ignore any errors during auto-assignment — we still return existing rows
    }

    // Lazy reset: If a daily quest hasn't been reset today, reset it when
    // the user fetches their quests. This complements the scheduled job and
    // ensures users who hit the server after a missed cron still get fresh
    // daily quests.
    const today = new Date().toDateString();
    for (const uq of all) {
      try {
        if (uq.quest && uq.quest.type === QuestType.DAILY) {
          // lastResetDate may come back from the DB as a string (YYYY-MM-DD)
          // or as a Date object depending on the driver. Normalize safely.
          const lastReset = uq.lastResetDate
            ? uq.lastResetDate instanceof Date
              ? uq.lastResetDate.toDateString()
              : new Date(uq.lastResetDate).toDateString()
            : null;

          if (!lastReset || lastReset !== today) {
            // Reset this daily quest for the user
            await this.resetDailyQuest(userId, uq.quest.id);
          }
        }
      } catch (err) {
        // Log reset failures so we can diagnose DB type issues instead of
        // silently swallowing them.
        this.logger.warn(
          `Failed to reset daily quest ${uq.questId} for user ${userId}: ${
            (err as Error)?.message || String(err)
          }`,
        );
      }
    }

    // Re-fetch after any potential resets so we return authoritative state
    const refreshed = await this.userQuestRepository.find({
      where: { userId },
      relations: ['quest'],
      order: { createdAt: 'DESC' },
    });

    return refreshed.filter(
      (uq) =>
        !(uq.status === QuestStatus.COMPLETED && uq.rewardsClaimed === true),
    );
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
      // before marking completed. Do NOT deduct here: deduction occurs
      // when the user claims the reward to make the flow: Start -> Check -> Claim
      if (
        quest.requirements?.collectItems &&
        quest.requirements.collectItems.length > 0
      ) {
        const missing: Array<{
          itemId: number;
          required: number;
          have: number;
        }> = [];

        // Verify all required items exist in user's inventory
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
      }

      // Mark as completed and persist; do NOT apply rewards here. Rewards
      // are applied when the player explicitly claims them. Also mark
      // rewardsClaimed=false so claim can apply rewards exactly once.
      userQuest.status = QuestStatus.COMPLETED;
      userQuest.completedAt = new Date();
      userQuest.completionCount = (userQuest.completionCount || 0) + 1;
      (userQuest as any).rewardsClaimed = false;
      await this.userQuestRepository.save(userQuest);
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

    // If the userQuest exists but lacks collectItems progress, populate a
    // transient progress object from the authoritative inventory so the
    // frontend can show partial progress (e.g., 5/50) even when the quest
    // hasn't been completed. We do NOT persist this change to the DB;
    // this simply augments the returned object for UI convenience.
    try {
      if (
        userQuest &&
        userQuest.quest &&
        userQuest.quest.requirements?.collectItems &&
        userQuest.quest.requirements.collectItems.length > 0
      ) {
        const currentProgress = userQuest.progress || {};
        const collectReqs = userQuest.quest.requirements.collectItems;

        // Ensure we have an array to merge into
        const collectProgress = Array.isArray(currentProgress.collectItems)
          ? [...currentProgress.collectItems]
          : [];

        for (const itemReq of collectReqs) {
          const itemIdNum = Number(itemReq.itemId);

          // If progress already contains this item, skip
          const existing = collectProgress.find(
            (p) => Number(p.itemId) === itemIdNum,
          );
          if (existing) continue;

          // Look up inventory for this item
          const inv = userItems.find(
            (ui) =>
              Number(ui.itemId) === itemIdNum ||
              Number(ui.item?.id) === itemIdNum,
          );
          const haveQty = inv?.quantity || 0;

          collectProgress.push({
            itemId: itemIdNum,
            current: haveQty,
            required: Number(itemReq.quantity),
          });
        }

        userQuest.progress = {
          ...currentProgress,
          collectItems: collectProgress,
        };
      }
    } catch (e) {
      // Non-fatal: if any error occurs while building progress for the UI,
      // ignore it so we still return the core response.
      this.logger.warn(
        'Failed to build transient collectItems progress for API response',
        e,
      );
    }

    return { completed, userQuest, userItems };
  }

  /**
   * Claim rewards for a completed UserQuest. This endpoint is idempotent
   * from the frontend perspective: rewards are applied during completion
   * already, so this just returns authoritative user state so the client
   * can update caches/UI when the player presses "Nhận thưởng".
   */
  async claimQuestReward(
    userId: number,
    userQuestId: number,
  ): Promise<{
    message: string;
    user?: User | null;
    userQuest?: UserQuest | null;
    userItems?: any[];
  }> {
    const userQuest = await this.userQuestRepository.findOne({
      where: { id: userQuestId, userId },
      relations: ['quest'],
    });
    if (!userQuest) {
      return { message: 'User quest not found' };
    }

    // Only allow claiming for completed quests
    if (userQuest.status !== QuestStatus.COMPLETED) {
      return { message: 'Quest not completed yet', userQuest };
    }

    // Apply rewards only if they have not been claimed yet. This ensures
    // the reward flow is: start -> check -> claim and prevents double application.
    if (!(userQuest as any).rewardsClaimed) {
      try {
        const quest = userQuest.quest;
        if (quest) {
          // If quest requires collected items, attempt to deduct them now
          if (
            quest.requirements?.collectItems &&
            quest.requirements.collectItems.length > 0
          ) {
            const missing: Array<{
              itemId: number;
              required: number;
              have: number;
            }> = [];

            // Verify availability first
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
                missing.push({
                  itemId: Number(itemReq.itemId),
                  required: Number(itemReq.quantity),
                  have: 0,
                });
              }
            }

            if (missing.length > 0) {
              // Abort claim: inform client that items are missing
              return {
                message: 'Missing required items for quest claim',
                user: null,
                userQuest,
                userItems: [],
              };
            }

            // Deduct items
            for (const itemReq of quest.requirements.collectItems) {
              try {
                const removed = await this.userItemsService.removeItemFromUser(
                  userId,
                  Number(itemReq.itemId),
                  Number(itemReq.quantity),
                );
                if (!removed) {
                  console.error(
                    'Failed to remove required quest items during claim',
                    {
                      userId,
                      userQuestId,
                      itemId: itemReq.itemId,
                      quantity: itemReq.quantity,
                    },
                  );
                  return {
                    message: 'Failed to remove required quest items',
                    user: null,
                    userQuest,
                    userItems: [],
                  };
                }
              } catch (err) {
                console.error(
                  'Error removing required quest item during claim',
                  err,
                );
                return {
                  message: 'Error removing required quest items',
                  user: null,
                  userQuest,
                  userItems: [],
                };
              }
            }
          }

          await this.applyQuestRewards(userId, quest);
        }

        // Mark rewards as claimed and persist
        (userQuest as any).rewardsClaimed = true;
        await this.userQuestRepository.save(userQuest);
      } catch (err) {
        console.error(
          'Error applying quest rewards during claim:',
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Fetch authoritative user and inventory so frontend can apply them
    let user: User | null = null;
    let userItems: any[] = [];
    try {
      user = await this.userRepository.findOne({ where: { id: userId } });
    } catch {
      // ignore
    }

    try {
      userItems = await this.userItemsService.findByUserId(userId);
    } catch {
      // ignore
    }

    return {
      message: 'Rewards claimed (or already applied)',
      user,
      userQuest,
      userItems,
    };
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
          try {
            const lastReset = userQuest?.lastResetDate
              ? userQuest.lastResetDate instanceof Date
                ? userQuest.lastResetDate.toDateString()
                : new Date(userQuest.lastResetDate).toDateString()
              : null;

            if (lastReset !== today) {
              // Reset daily quest
              await this.resetDailyQuest(userId, quest.id);
            }
          } catch (err) {
            this.logger.warn(
              `Failed to check/reset daily quest ${quest.id} for user ${userId}: ${
                (err as Error)?.message || String(err)
              }`,
            );
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
      collectedItems?: { itemId: number; quantity: number }[];
    },
  ): Promise<void> {
    // Check if this combat result was already processed for quests
    const existingTracking = await this.questCombatTrackingRepository.findOne({
      where: { userId, combatResultId },
    });

    if (existingTracking?.questProgressUpdated) {
      return; // Already processed
    }

    // Load the combat result so we can compare timestamps, dungeon and result
    const combatResult = await this.combatResultRepository.findOne({
      where: { id: combatResultId },
    });

    if (!combatResult) {
      // If there's no combat record we can't safely attribute progress
      return;
    }

    // Debug: log incoming combat and basic metadata to help diagnose
    try {
      const createdAtStr =
        combatResult.createdAt instanceof Date
          ? combatResult.createdAt.toISOString()
          : String(combatResult.createdAt);

      this.logger.debug(
        `updateQuestProgressFromCombat: userId=${userId} combatResultId=${combatResultId} combatCreatedAt=${createdAtStr}`,
      );

      this.logger.debug('combatData payload: ' + JSON.stringify(combatData));

      const summary = {
        id: combatResult.id,
        result: combatResult.result,
        dungeonId: combatResult.dungeonId,
        rewardsItems: Array.isArray((combatResult.rewards as any)?.items)
          ? ((combatResult.rewards as any).items as any[]).length
          : 0,
        logsCount: Array.isArray((combatResult as any).logs)
          ? ((combatResult as any).logs as any[]).length
          : 0,
      };

      this.logger.debug('combatResult summary: ' + JSON.stringify(summary));
    } catch (e) {
      // Log but do not throw — logging must not break progress flow
      try {
        this.logger.debug(
          'Failed to stringify combat debug data: ' + String(e),
        );
      } catch {
        // last resort: ignore
      }
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
        const ca =
          combatCreatedAt instanceof Date
            ? combatCreatedAt.toISOString()
            : String(combatCreatedAt);
        const sa =
          userQuest.startedAt instanceof Date
            ? userQuest.startedAt.toISOString()
            : String(userQuest.startedAt);
        this.logger.debug(
          `Skipping combat ${combatResultId} for userQuest id=${userQuest.id} because combatCreatedAt (${ca}) < startedAt (${sa})`,
        );
        continue;
      }
      const quest = await this.getQuestById(userQuest.questId);
      if (!quest) continue;

      let progressUpdated = false;

      // Update dungeon completion progress ONLY on victory results
      if (
        combatData.dungeonId &&
        quest.requirements.completeDungeons &&
        combatResult &&
        combatResult.result === CombatResultType.VICTORY
      ) {
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

      // Update collected items progress (from combat rewards)
      if (combatData.collectedItems && quest.requirements.collectItems) {
        const collected = combatData.collectedItems as Array<{
          itemId: number;
          quantity: number;
        }>;
        const currentProgress = userQuest.progress?.collectItems || [];

        for (const col of collected) {
          for (const itemReq of quest.requirements.collectItems) {
            if (Number(itemReq.itemId) === Number(col.itemId)) {
              const existing = currentProgress.find(
                (p: any) => Number(p.itemId) === Number(col.itemId),
              );
              if (existing) {
                existing.current =
                  (existing.current || 0) + Number(col.quantity || 0);
              } else {
                currentProgress.push({
                  itemId: Number(col.itemId),
                  current: Number(col.quantity || 0),
                  required: Number(itemReq.quantity),
                });
              }
              progressUpdated = true;
            }
          }
        }

        if (progressUpdated) {
          userQuest.progress = {
            ...userQuest.progress,
            collectItems: currentProgress,
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

  async deleteQuest(id: number, force: boolean = false): Promise<void> {
    // Safe deletion: if force=false, attempt a simple delete and surface
    // DB constraint errors as readable messages. If force=true, remove
    // dependent rows (user_quests, quest_combat_tracking) before deleting.
    if (!force) {
      const result = await this.questRepository.delete(id);
      if (result.affected === 0) {
        throw new Error('Quest not found');
      }
      return;
    }

    // Force delete: perform manual cleanup in correct order within a transaction
    const queryRunner =
      this.questRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Delete quest combat tracking entries
      await queryRunner.manager.delete('quest_combat_tracking', {
        questId: id,
      });

      // Delete user_quests rows
      await queryRunner.manager.delete('user_quests', {
        questId: id,
      });

      // Finally delete quest
      const delRes = await queryRunner.manager.delete('quests', {
        id,
      });
      if (!delRes.affected || delRes.affected === 0) {
        throw new Error('Quest not found during forced delete');
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      // Re-throw a readable error
      const message = (err as Error)?.message || String(err);
      throw new Error(`Failed to force-delete quest: ${message}`);
    } finally {
      await queryRunner.release();
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
