/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CombatResult, CombatResultType } from './combat-result.entity';
import { CombatLog } from './combat-log.entity';
import { User } from '../users/user.entity';
import { Dungeon } from '../dungeons/dungeon.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import { UserItemsService } from '../user-items/user-items.service';
import { LevelsService } from '../levels/levels.service';
import { UserStatsService } from '../user-stats/user-stats.service';
import { UserStaminaService } from '../user-stamina/user-stamina.service';
import { Monster } from '../monsters/monster.entity';
import { ItemsService } from '../items/items.service';
import { SkillService } from '../player-skills/skill.service';
import { QuestService } from '../quests/quest.service';
import { StoryEventsService } from '../story-events/story-events.service';
import { PetService } from '../pets/pet.service';
import { PetAbility } from '../pets/entities/pet-ability.entity';
import { runCombat } from '../combat-engine/engine';
import { deriveCombatStats } from '../combat-engine/stat-converter';

@Injectable()
export class CombatResultsService {
  constructor(
    @InjectRepository(CombatResult)
    private combatResultsRepository: Repository<CombatResult>,
    @InjectRepository(CombatLog)
    private combatLogsRepository: Repository<CombatLog>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Dungeon)
    private dungeonsRepository: Repository<Dungeon>,
    @InjectRepository(UserStat)
    private userStatsRepository: Repository<UserStat>,
    @InjectRepository(Monster)
    private monstersRepository: Repository<Monster>,
    @InjectRepository(PetAbility)
    private petAbilityRepository: Repository<PetAbility>,
    private userItemsService: UserItemsService,
    private levelsService: LevelsService,
    private userStaminaService: UserStaminaService,
    private userStatsService: UserStatsService,
    private itemsService: ItemsService,
    private skillService: SkillService,
    private questService: QuestService,
    private storyEventsService: StoryEventsService,
    private petService: PetService,
  ) {}

  /**
   * Calculate total core attributes for a user including base stats, level bonuses, class bonuses, equip bonuses, and pet buff
   */
  private async calculateTotalCoreAttributes(userId: number): Promise<{
    STR: number;
    INT: number;
    DEX: number;
    VIT: number;
    LUK: number;
  }> {
    // Use the authoritative getTotalStatsWithAllBonuses to ensure consistency
    // This includes: base stats, allocated points, level bonuses, class bonuses,
    // equipment, item sets, guild buffs, and titles
    const totalStats =
      await this.userStatsService.getTotalStatsWithAllBonuses(userId);

    // Add pet stat buff (20% of active pet's stats)
    const activePet = await this.petService.getActivePet(userId);
    const petBuff = activePet?.getPlayerStatBuff() || {
      strength: 0,
      intelligence: 0,
      dexterity: 0,
      vitality: 0,
      luck: 0,
    };

    console.log(`[PET BUFF DEBUG] User ${userId}:`, {
      hasActivePet: !!activePet,
      petName: activePet?.name,
      petStats: activePet?.stats,
      petBuff,
      baseStats: {
        str: totalStats.str,
        int: totalStats.int,
        dex: totalStats.dex,
        vit: totalStats.vit,
        luk: totalStats.luk,
      },
      finalStats: {
        STR: totalStats.str + petBuff.strength,
        INT: totalStats.int + petBuff.intelligence,
        DEX: totalStats.dex + petBuff.dexterity,
        VIT: totalStats.vit + petBuff.vitality,
        LUK: totalStats.luk + petBuff.luck,
      },
    });

    return {
      STR: totalStats.str + petBuff.strength,
      INT: totalStats.int + petBuff.intelligence,
      DEX: totalStats.dex + petBuff.dexterity,
      VIT: totalStats.vit + petBuff.vitality,
      LUK: totalStats.luk + petBuff.luck,
    };
  }

  async startCombat(userIds: number[], dungeonId: number) {
    console.log(
      `[ITEM DEBUG - COMBAT SERVICE] ===== Starting combat for users ${userIds.join(', ')} in dungeon ${dungeonId} =====`,
    );
    const startTime = Date.now();

    // Lấy thông tin users và dungeon
    const users = await this.usersRepository.find({
      where: userIds.map((id) => ({ id })),
      relations: ['stats'],
    });

    const dungeon = await this.dungeonsRepository.findOne({
      where: { id: dungeonId },
    });

    console.log(`[ITEM DEBUG - COMBAT SERVICE] Dungeon info:`, {
      id: dungeon?.id,
      name: dungeon?.name,
      requiredItem: dungeon?.requiredItem,
    });

    if (users.length !== userIds.length || !dungeon) {
      throw new Error('Một số người chơi hoặc dungeon không tồn tại');
    }

    // ===== ITEM CONSUMPTION LOGIC =====
    // Check if dungeon requires an item
    if (dungeon.requiredItem) {
      console.log(
        `[ITEM DEBUG - COMBAT SERVICE] Dungeon requires item ${dungeon.requiredItem}`,
      );

      // Get required item info for better error messages
      let requiredItemName = `vật phẩm #${dungeon.requiredItem}`;
      try {
        const itemInfo = await this.itemsService.findOne(dungeon.requiredItem);
        if (itemInfo) {
          requiredItemName = itemInfo.name;
        }
      } catch (err) {
        console.warn(
          `[ITEM DEBUG - COMBAT SERVICE] Could not fetch item info for ${dungeon.requiredItem}:`,
          err,
        );
      }

      // First, check if all users have the required item
      console.log(
        `[ITEM DEBUG - COMBAT SERVICE] Checking required items for ${users.length} users...`,
      );

      for (const user of users) {
        console.log(
          `[ITEM DEBUG - COMBAT SERVICE] ===== Checking user ${user.id} (${user.username}) =====`,
        );

        // Get current item count before any operations
        const beforeItems = await this.userItemsService.findByUserId(user.id);
        const beforeCount =
          beforeItems.find((item) => item.itemId === dungeon.requiredItem)
            ?.quantity || 0;

        console.log(
          `[ITEM DEBUG - COMBAT SERVICE] User ${user.id} has ${beforeCount}x item ${dungeon.requiredItem} BEFORE any operations`,
        );

        // Check if user has the required item
        const userItemData = await this.userItemsService.findByUserAndItem(
          user.id,
          dungeon.requiredItem,
        );

        console.log(
          `[ITEM DEBUG - COMBAT SERVICE] findByUserAndItem result for user ${user.id}:`,
          userItemData,
        );

        if (!userItemData || userItemData.quantity < 1) {
          throw new Error(
            `Người chơi ${user.username} không có đủ ${requiredItemName} để vào hầm ngục này`,
          );
        }
      }

      // If all users have required items, consume them
      console.log(
        `[ITEM DEBUG - COMBAT SERVICE] All users have required items, proceeding to consumption...`,
      );

      for (const user of users) {
        console.log(
          `[ITEM DEBUG - COMBAT SERVICE] ===== Consuming item from user ${user.id} (${user.username}) =====`,
        );

        // Get item count before consumption
        const beforeItems = await this.userItemsService.findByUserId(user.id);
        const beforeCount =
          beforeItems.find((item) => item.itemId === dungeon.requiredItem)
            ?.quantity || 0;

        console.log(
          `[ITEM DEBUG - COMBAT SERVICE] User ${user.id} has ${beforeCount}x item ${dungeon.requiredItem} BEFORE consumption`,
        );

        // Remove the item
        const removeResult = await this.userItemsService.removeItemFromUser(
          user.id,
          dungeon.requiredItem,
          1,
        );

        console.log(
          `[ITEM DEBUG - COMBAT SERVICE] removeItemFromUser result for user ${user.id}:`,
          removeResult,
        );

        // Verify item was consumed
        const afterItems = await this.userItemsService.findByUserId(user.id);
        const afterCount =
          afterItems.find((item) => item.itemId === dungeon.requiredItem)
            ?.quantity || 0;

        console.log(
          `[ITEM DEBUG - COMBAT SERVICE] User ${user.id} has ${afterCount}x item ${dungeon.requiredItem} AFTER consumption (should be ${beforeCount - 1})`,
        );

        if (afterCount !== beforeCount - 1) {
          console.error(
            `[ITEM DEBUG - COMBAT SERVICE] ❌ Item consumption verification FAILED for user ${user.id}! Expected ${beforeCount - 1}, got ${afterCount}`,
          );
        } else {
          console.log(
            `[ITEM DEBUG - COMBAT SERVICE] ✅ Item consumption verification SUCCESS for user ${user.id}`,
          );
        }
      }

      console.log(
        `[ITEM DEBUG - COMBAT SERVICE] ===== Item consumption completed for all users =====`,
      );
    } else {
      console.log(
        `[ITEM DEBUG - COMBAT SERVICE] Dungeon ${dungeonId} does not require any items`,
      );
    }

    // Kiểm tra level requirement cho tất cả users
    for (const user of users) {
      if (user.level < dungeon.levelRequirement) {
        throw new Error(`Người chơi ${user.username} không đủ level yêu cầu`);
      }
    }

    // Kiểm tra và tiêu thụ stamina cho tất cả users
    const staminaCost = 10; // Cost per dungeon run
    for (const user of users) {
      const stamina = await this.userStaminaService.getUserStaminaWithoutRegen(
        user.id,
      );
      if (stamina.currentStamina < staminaCost) {
        throw new Error(
          `Người chơi ${user.username} không đủ stamina (${stamina.currentStamina}/${stamina.maxStamina})`,
        );
      }
    }

    // Tiêu thụ stamina
    for (const user of users) {
      await this.userStaminaService.consumeStamina(user.id, staminaCost);
    }

    // Ensure we have the freshest UserStat records in case they were updated
    // recently (e.g., equip or awaken endpoints updated derived stats).
    // Use the UserStatsService which centralizes find/create behavior and
    // returns relations. If a UserStat row is missing create a default one
    // so the engine never observes an absent/stale default (maxHp=100).
    for (const user of users) {
      try {
        const freshStats = await this.userStatsService.findByUserId(user.id);
        if (freshStats) {
          user.stats = freshStats;
        } else {
          // Create a default stats row if missing to avoid falling back to
          // partial objects or undefined values later in the pipeline.
          console.warn(
            `Combat - user ${user.id} has no UserStat, creating default row`,
          );
          const created = await this.userStatsService.create({
            userId: user.id,
          });
          user.stats = created;
        }
      } catch (err) {
        console.warn(
          `Could not refresh/create stats for user ${user.id}:`,
          err?.message || err,
        );
      }
    }

    // Diagnostic: log refreshed stats to help debug incorrect maxHp in combat payload
    try {
      console.log(
        'Debug - startCombat users stats:',
        users.map((u) => ({
          id: u.id,
          username: u.username,
          maxHp: u.stats?.currentHp, // Only currentHp exists now
          currentMana: u.stats?.currentMana, // Check if mana persists from DB
        })),
      );
    } catch {
      // ignore
    }

    // Thực hiện combat logic
    const combatResult = await this.processTeamCombat(users, dungeon);

    // Tính thời gian
    const duration = Date.now() - startTime;

    // Khởi tạo team stats - calculate maxHp from derived stats
    const teamMaxHpPromises = users.map(async (user) => {
      const coreAttrs = await this.calculateTotalCoreAttributes(user.id);
      // Get passive skill bonuses
      const skillEffects = await this.skillService.getPlayerSkillEffects(
        user.id,
      );
      const derivedStats = deriveCombatStats({
        baseAttack: 10,
        baseMaxHp: 100,
        baseDefense: 5,
        ...coreAttrs,
      });
      // Apply skill bonuses to derived stats
      derivedStats.attack += skillEffects.statBonuses.attack || 0;
      derivedStats.defense += skillEffects.statBonuses.defense || 0;
      derivedStats.maxHp += skillEffects.statBonuses.maxHp || 0;
      derivedStats.critRate += skillEffects.statBonuses.critRate || 0;
      derivedStats.critDamage += skillEffects.statBonuses.critDamage || 0;
      derivedStats.dodgeRate += skillEffects.statBonuses.dodgeRate || 0;
      return derivedStats.maxHp;
    });
    const teamMaxHps = await Promise.all(teamMaxHpPromises);

    const teamStats = {
      totalHp: teamMaxHps.reduce((sum, maxHp) => sum + maxHp, 0),
      currentHp: users.reduce((sum, user) => sum + user.stats.currentHp, 0),
      members: users.map((user, idx) => ({
        userId: user.id,
        username: user.username,
        hp: user.stats.currentHp,
        maxHp: teamMaxHps[idx],
      })),
    };

    // Normalize engine logs to DB shape: CombatLog requires userId (the
    // member involved). For player actions this is the actor, for enemy
    // actions this should be the target player. We also map details fields
    // into the expected structure so cascading insert works.
    const internalEnemies = (combatResult as any).internalEnemies || [];

    const normalizeAction = (t: string) => {
      // DB enum: 'attack'|'defend'|'skill'|'item'|'escape'
      if (!t) return 'attack';
      const map: Record<string, string> = {
        attack: 'attack',
        miss: 'attack', // treat miss as an attack with isMiss flag
        counter: 'attack',
        combo: 'attack',
        skill: 'skill',
        item: 'item',
        escape: 'escape',
        pet_ability: 'skill', // Treat pet abilities as skills for DB enum compatibility
      };
      return map[t] ?? 'attack';
    };

    const normalizedLogs = (combatResult.logs || []).map((l: any) => {
      // Handle pet ability logs - they already have userId set to the owner's ID
      // and don't use actorIsPlayer flag
      if (l.action === 'pet_ability') {
        // Pet ability logs already have userId set correctly by resolvePetAbility
        // Just use the userId from the log directly
        const userId = l.userId || (users[0]?.id ?? null);

        const effects: string[] = [];
        // Pet abilities may have effects in the future
        if (l.details?.effects) {
          effects.push(...l.details.effects);
        }

        return {
          turn: l.turn,
          actionOrder: l.actionOrder,
          action: normalizeAction(l.action),
          userId,
          details: {
            actor: 'pet', // Preserve pet actor type
            actorName: l.details?.actorName || 'Pet',
            petId: l.details?.petId,
            targetName: l.details?.targetName,
            targetIndex: l.details?.targetIndex,
            damage: l.details?.damage,
            damageType: l.details?.damageType,
            isCritical: l.details?.isCritical || false,
            isMiss: l.details?.isMiss || false,
            hpBefore: l.details?.hpBefore,
            hpAfter: l.details?.hpAfter,
            description: l.details?.description || '',
            abilityIcon: l.details?.abilityIcon,
            effects,
          },
        };
      }

      // Original logic for player/enemy actions
      // Determine which user the DB's userId field should reference:
      // - If actor is a player, it's the actor's userId
      // - Otherwise, for enemy actions we map to the target player userId
      const userId = l.actorIsPlayer
        ? l.actorId
        : l.targetIsPlayer
          ? l.targetId
          : (users[0]?.id ?? null);

      const effects: string[] = [];
      if (l.flags) {
        if (l.flags.crit) effects.push('Chí mạng!');
        if (l.flags.lifesteal)
          effects.push(
            `Hút máu +${Math.round(Number(l.flags.lifesteal) || 0)}`,
          );
        if (l.flags.armorPen) effects.push(`Xuyên giáp +${l.flags.armorPen}`);
        if (l.flags.comboIndex)
          effects.push(`Liên kích lần ${l.flags.comboIndex}`);
        if (l.flags.counter) effects.push('Phản kích!');
        if (l.flags.dodge) effects.push('Né tránh!');
      }

      // Compute a frontend-friendly targetIndex when the engine provided only
      // a targetId. Engine targetId refers to the enemy input `id` which we
      // set to `instanceId` for duplicates; prefer matching instanceId, but
      // fall back to template id (e.id) when appropriate.
      let targetIndex = l.targetIndex;
      // Only attempt to resolve numeric targetId -> enemy index when the
      // engine log indicates the target is an enemy. Some engine logs may
      // use player ids for self-targeting effects (lifesteal, heal). Those
      // must not be mapped to enemy indices because numeric ids can collide
      // between players and enemy instanceIds.
      if (
        typeof targetIndex === 'undefined' &&
        typeof l.targetId !== 'undefined' &&
        l.targetIsPlayer === false
      ) {
        const idx = internalEnemies.findIndex(
          (e: any) =>
            (e.instanceId && e.instanceId === l.targetId) ||
            e.id === l.targetId,
        );
        if (idx >= 0) targetIndex = idx;
      }

      return {
        turn: l.turn,
        actionOrder: l.actionOrder,
        action: normalizeAction(l.type),
        userId,
        details: {
          actor: l.actorIsPlayer ? 'player' : 'enemy',
          actorName: l.actorName,
          targetName: l.targetName,
          targetIndex,
          damage: l.damage,
          isCritical: !!l.flags?.crit,
          isMiss: !!l.flags?.dodge || l.type === 'miss',
          hpBefore: l.hpBefore,
          hpAfter: l.hpAfter,
          manaBefore: l.manaBefore, // ✅ Add mana tracking for frontend animation
          manaAfter: l.manaAfter,
          manaCost: l.manaCost,
          description: l.description,
          effects,
        },
      };
    });

    // Lưu kết quả and capture saved entity (so we have the generated id)
    // Debug log: ensure seedUsed is present on the engine result before saving
    console.log(
      'Debug - seed to persist:',
      (combatResult as any)?.seedUsed ?? (combatResult as any)?.seed ?? null,
    );
    const savedCombat = await this.combatResultsRepository.save({
      userIds,
      dungeonId,
      result: combatResult.result as CombatResultType,
      duration,
      rewards: combatResult.rewards,
      teamStats: {
        ...teamStats,
        currentHp: combatResult.teamStats.currentHp, // Sử dụng HP sau combat
        members: combatResult.teamStats.members,
      },
      logs: normalizedLogs,
      // persist the deterministic RNG seed so replays can be reproduced
      seed:
        (combatResult as any)?.seedUsed ?? (combatResult as any)?.seed ?? null,
    }); // Cập nhật user stats và rewards
    if (combatResult.result === 'victory') {
      // We want item drops to be independent per player (each player rolls
      // separately for dungeon drops and per-monster drops). Experience and
      // gold will remain split evenly among the party (previous behavior).
      // First split experience/gold across users (no items yet).
      const perUserBase = this.distributeRewardsToUsers(
        {
          experience: combatResult.rewards.experience,
          gold: combatResult.rewards.gold,
          items: [],
        },
        users,
      );

      // Roll monster and dungeon drops per-user independently so each player
      // gets separate luck. Pass the full dungeon (with its dropItems) so
      // calculatePerUserItemRewards will also process dungeon-level drops per-user.
      const perUserItems = this.calculatePerUserItemRewards(
        ((combatResult as any).internalEnemies as any[]) || [],
        dungeon,
        users.length,
      );

      // Build per-user combined rewards (exp/gold from split + items from independent rolls)
      const perUserCombined = perUserBase.map((base: any, idx: number) => ({
        experience: base.experience,
        gold: base.gold,
        items: perUserItems[idx] || [],
      }));

      // Enrich per-user item entries with item names when possible so UI shows names
      if (this.itemsService) {
        for (const userRewards of perUserCombined) {
          if (!Array.isArray(userRewards.items)) continue;
          for (const it of userRewards.items) {
            try {
              const item = await this.itemsService.findOne(it.itemId);
              if (item) it.name = item.name;
            } catch (err) {
              console.warn('Failed to lookup item name for', it.itemId, err);
            }
          }
        }
      }

      // Attach per-user info to combatResult so finalResult can surface single-player reward
      (combatResult as any).__perUserCombined = perUserCombined;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const base = perUserBase[i] || { experience: 0, gold: 0, items: [] };
        const items = perUserItems[i] || [];

        const rewardForUser = {
          experience: base.experience,
          gold: base.gold,
          items,
        };

        await this.applyRewards(user, rewardForUser);
      }

      // Inform story-events system about this combat so event progress (dungeon clears, enemy kills, item contributions) is updated
      try {
        // Compute aggregate enemyKills for this combat (group by enemy name)
        const defeatedEnemies = (internalEnemies || []).filter((e) =>
          typeof e.hp === 'number' ? e.hp <= 0 : false,
        );
        const enemyTypeCount = new Map<string, number>();
        for (const enemy of defeatedEnemies) {
          const enemyType = String(enemy.name || '').toLowerCase();
          enemyTypeCount.set(
            enemyType,
            (enemyTypeCount.get(enemyType) || 0) + 1,
          );
        }
        const enemyKills = Array.from(enemyTypeCount.entries()).map(
          ([enemyType, count]) => ({ enemyType, count }),
        );

        for (let i = 0; i < users.length; i++) {
          const user = users[i];
          const perUser =
            perUserCombined && perUserCombined[i]
              ? perUserCombined[i]
              : { items: [] };
          const collectedItems = Array.isArray(perUser.items)
            ? perUser.items.map((it: any) => ({
                itemId: Number(it.itemId),
                quantity: Number(it.quantity || 0),
              }))
            : [];
          try {
            await this.storyEventsService.processCombatForUser(
              user.id,
              (savedCombat as any)?.id,
              {
                dungeonId: dungeon?.id ?? null,
                enemyKills,
                collectedItems,
                bossDefeated: false,
              },
            );
          } catch (e) {
            // non-fatal: log and continue
            console.warn(
              'Failed to process story events for user after dungeon combat:',
              e,
            );
          }
        }
      } catch (e) {
        console.warn(
          'Failed to compute/process story event updates after dungeon combat:',
          e,
        );
      }
    }

    // Update user HP and Mana after combat
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const finalHp =
        combatResult.teamStats.members[i]?.hp ?? user.stats.currentHp;
      if (finalHp !== user.stats.currentHp) {
        try {
          await this.userStatsService.updateByUserId(user.id, {
            currentHp: finalHp,
          });
        } catch (err) {
          console.warn(
            `Failed to update HP for user ${user.id} after combat:`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      // Persist currentMana after combat (strategic resource management)
      const finalMana = combatResult.finalPlayers[i]?.stats?.currentMana;
      if (finalMana !== undefined && finalMana !== user.stats.currentMana) {
        try {
          await this.userStatsService.updateByUserId(user.id, {
            currentMana: finalMana,
          });
          console.log(
            `✅ Persisted mana for user ${user.id}: ${finalMana}/${combatResult.finalPlayers[i]?.stats?.maxMana}`,
          );
        } catch (err) {
          console.warn(
            `Failed to update mana for user ${user.id} after combat:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    const finalResult = {
      // include persisted id for clients to reference
      id: (savedCombat as any)?.id,
      combatResultId: (savedCombat as any)?.id,
      result: combatResult.result,
      duration,
      // If we computed per-user rewards, include them in the final payload so
      // clients can see which user received which items. For solo runs we
      // continue to return the single user's reward object for backward
      // compatibility.
      rewards: (combatResult as any).__perUserCombined
        ? users.length === 1
          ? (combatResult as any).__perUserCombined[0]
          : {
              aggregated: combatResult.rewards,
              perUser: (combatResult as any).__perUserCombined,
            }
        : combatResult.rewards,
      // return the persisted logs (so log entries include DB-generated ids)
      logs: (savedCombat as any)?.logs ?? combatResult.logs,
      teamStats: combatResult.teamStats,
      enemies: combatResult.enemies || [], // Add enemies data
      // helpful for frontend initialization (shows original max HP & stats)
      originalEnemies:
        (combatResult as any).originalEnemies ||
        (combatResult as any).internalEnemies ||
        [],
    };

    console.log('Debug - Final combat result structure:', {
      enemiesCount: finalResult.enemies.length,
      enemies: finalResult.enemies,
      sampleLog: finalResult.logs[0] || 'No logs',
    });

    return finalResult;
  }

  /**
   * Run combat for given users against explicit enemy templates.
   * enemiesTemplates: [{ monsterId: number, count: number }...]
   */
  async startCombatWithEnemies(
    userIds: number[],
    enemiesTemplates: any[],
    _options?: any,
  ) {
    console.log('🚀 [WILDAREA COMBAT] startCombatWithEnemies called with:', {
      userIds,
      enemiesTemplates,
      _options,
    });

    const users = await this.usersRepository.find({
      where: userIds.map((id) => ({ id })),
      relations: ['stats'],
    });

    if (users.length !== userIds.length) {
      throw new Error('Một số người chơi không tồn tại');
    }

    // avoid unused parameter lint
    void _options;

    // NOTE: stamina is expected to be checked/consumed by caller (e.g., ExploreService)
    // to avoid double-consuming when enqueuing the job. Do not consume here.

    // Ensure freshest stats for this code path as well (startCombatWithEnemies
    // is used by callers that may not pass through the same stamina/flow).
    for (const user of users) {
      try {
        const freshStats = await this.userStatsService.findByUserId(user.id);
        if (freshStats) user.stats = freshStats;
        else {
          console.warn(
            `Combat (with enemies) - user ${user.id} missing UserStat, creating default`,
          );
          const created = await this.userStatsService.create({
            userId: user.id,
          });
          user.stats = created;
        }
      } catch (err) {
        console.warn(
          `Could not refresh/create stats for user ${user.id} (with enemies):`,
          err?.message || err,
        );
      }
    }

    // Build internalEnemies similar to processTeamCombat but using monster templates
    const internalEnemies: any[] = [];
    let instanceCounter = 1;
    for (const t of enemiesTemplates) {
      const monster = await this.monstersRepository.findOne({
        where: { id: t.monsterId },
      });
      if (!monster) continue;
      const count = Math.max(1, Number(t.count) || 1);
      for (let i = 0; i < count; i++) {
        internalEnemies.push({
          id: monster.id,
          instanceId: instanceCounter++,
          name: monster.name,
          hp: monster.baseHp,
          maxHp: monster.baseHp,
          attack: monster.baseAttack,
          defense: monster.baseDefense,
          level: monster.level,
          type: monster.type,
          element: monster.element,
          experienceReward: monster.experienceReward,
          goldReward: monster.goldReward,
          dropItems: monster.dropItems || [],
        });
      }
    }

    // Fallback enemy if none
    if (internalEnemies.length === 0) {
      internalEnemies.push({
        id: 999,
        name: 'Cương thi',
        hp: 100,
        maxHp: 100,
        attack: 15,
        defense: 5,
        level: users[0]?.level || 1,
        type: 'undead',
        element: 'dark',
        experienceReward: 10,
        goldReward: 5,
        dropItems: [],
      });
    }

    // Prepare player and enemy inputs for engine
    const playerInputsPromises = users.map(async (u) => {
      const coreAttrs = await this.calculateTotalCoreAttributes(u.id);
      // Get passive skill bonuses
      const skillEffects = await this.skillService.getPlayerSkillEffects(u.id);
      const derivedStats = deriveCombatStats({
        baseAttack: 10,
        baseMaxHp: 100,
        baseDefense: 5,
        ...coreAttrs,
      });
      // Apply skill bonuses to derived stats
      derivedStats.attack += skillEffects.statBonuses.attack || 0;
      derivedStats.defense += skillEffects.statBonuses.defense || 0;
      derivedStats.maxHp += skillEffects.statBonuses.maxHp || 0;
      derivedStats.critRate += skillEffects.statBonuses.critRate || 0;
      derivedStats.critDamage += skillEffects.statBonuses.critDamage || 0;
      derivedStats.dodgeRate += skillEffects.statBonuses.dodgeRate || 0;
      derivedStats.accuracy += skillEffects.statBonuses.accuracy || 0;

      // Get user's active skills
      const userSkills = await this.skillService.getPlayerSkills(u.id);
      console.log(
        `🔍 [startCombatWithEnemies] User ${u.id} (${u.username}) has ${userSkills.length} total skills`,
      );

      const activeSkills = userSkills
        .filter((ps) => {
          if (!ps.skillDefinition) {
            console.warn(
              `⚠️ PlayerSkill ${ps.id} has no skillDefinition relation!`,
            );
            return false;
          }
          // IMPORTANT: Only include EQUIPPED active skills
          if (!ps.isEquipped) {
            console.log(
              `⏭️ Skipping skill ${ps.skillDefinition.name} - not equipped`,
            );
            return false;
          }
          return ps.skillDefinition.skillType === 'active';
        })
        .map((ps) => ({
          id: ps.skillDefinition.skillId,
          name: ps.skillDefinition.name,
          skillType: ps.skillDefinition.skillType,
          manaCost: ps.skillDefinition.manaCost,
          cooldown: ps.skillDefinition.cooldown,
          targetType: ps.skillDefinition.targetType,
          damageType: ps.skillDefinition.damageType,
          damageFormula: ps.skillDefinition.damageFormula,
          healingFormula: ps.skillDefinition.healingFormula,
          effects: ps.skillDefinition.effects,
          level: ps.level,
        }));

      console.log(
        `✅ [startCombatWithEnemies] User ${u.id} has ${activeSkills.length} EQUIPPED active skills:`,
      );
      activeSkills.forEach((s) => {
        console.log(
          `   - ${s.name}: manaCost=${s.manaCost}, cooldown=${s.cooldown}, type=${s.skillType}`,
        );
      });

      // Initialize currentMana if NULL (first combat)
      const currentMana = u.stats.currentMana ?? derivedStats.maxMana;

      console.log(
        `🔍 [BEFORE SET] User ${u.id} (${u.username}) - DB currentMana: ${u.stats.currentMana}, derivedStats.currentMana: ${derivedStats.currentMana}, will set to: ${currentMana}`,
      );

      // Update stats with initialized currentMana
      derivedStats.currentMana = currentMana;

      console.log(
        `✅ [AFTER SET] User ${u.id} (${u.username}) - derivedStats.currentMana: ${derivedStats.currentMana}`,
      );

      return {
        id: u.id,
        name: u.username,
        isPlayer: true,
        stats: derivedStats,
        currentHp: u.stats.currentHp,
        skills: activeSkills,
        skillCooldowns: {}, // Initialize empty cooldowns
        metadata: {
          totalIntelligence: coreAttrs.INT,
          totalStrength: coreAttrs.STR,
          totalDexterity: coreAttrs.DEX,
          totalVitality: coreAttrs.VIT,
          totalLuck: coreAttrs.LUK,
        },
      };
    });

    const playerInputs = await Promise.all(playerInputsPromises);

    const enemyInputs = internalEnemies.map((en) => ({
      id: en.instanceId ?? en.id,
      name: en.name,
      isPlayer: false,
      stats: {
        maxHp: en.maxHp,
        attack: en.attack,
        defense: en.defense,
        critRate: 0,
        critDamage: 100,
        lifesteal: 0,
        armorPen: 0,
        dodgeRate: 0,
        accuracy: 0,
        comboRate: 0,
        counterRate: 0,
        maxMana: en.maxHp, // Enemies don't use mana, set to maxHp for consistency
        currentMana: en.maxHp,
      },
      currentHp: en.hp,
    }));

    const run = runCombat({
      players: playerInputs,
      enemies: enemyInputs,
    });

    const originalInternalEnemies = internalEnemies.map((e) => ({ ...e }));
    for (let i = 0; i < internalEnemies.length; i++) {
      internalEnemies[i].hp =
        run.finalEnemies[i]?.currentHp ?? internalEnemies[i].hp;
    }

    const finalTeamStats = {
      totalHp: playerInputs.reduce((sum, p) => sum + p.stats.maxHp, 0),
      currentHp: run.finalPlayers.reduce(
        (sum: number, p: any) => sum + (p.currentHp ?? p.stats.maxHp),
        0,
      ),
      members: users.map((user, idx) => ({
        userId: user.id,
        username: user.username,
        hp: run.finalPlayers[idx]?.currentHp ?? user.stats.currentHp,
        maxHp: playerInputs[idx].stats.maxHp,
        currentMana:
          run.finalPlayers[idx]?.stats?.currentMana ??
          playerInputs[idx].stats.currentMana,
        maxMana: playerInputs[idx].stats.maxMana,
      })),
    };

    // Diagnostic: log player inputs and finalPlayers from engine
    try {
      console.log(
        'Debug - processTeamCombat players input:',
        playerInputs.map((p) => ({
          id: p.id,
          maxHp: p.stats?.maxHp,
          currentHp: p.currentHp,
        })),
      );
      console.log(
        'Debug - processTeamCombat run.finalPlayers:',
        (run as any).finalPlayers,
      );
      console.log(
        'Debug - processTeamCombat built finalTeamStats.members:',
        finalTeamStats.members,
      );
    } catch (err) {
      console.warn('Debug log failed:', err);
    }

    const rewards = await this.calculateRewards(
      internalEnemies,
      { levelRequirement: users[0]?.level || 1 } as any,
      run.result,
    );

    // Map engine logs directly and build final result similar to startCombat
    const logs = (run.logs as any[]) || [];

    const finalEnemies = internalEnemies.map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      level: enemy.level,
      type: enemy.type,
      element: enemy.element,
    }));

    const combatResult = {
      result: run.result,
      logs,
      rewards,
      teamStats: finalTeamStats,
      enemies: finalEnemies,
      internalEnemies,
      originalEnemies: originalInternalEnemies,
      finalPlayers: run.finalPlayers, // ✅ ADD: Needed for mana persistence
      seedUsed: (run as any).seedUsed ?? null,
    } as any;

    // Persist similar to startCombat to get a DB id and apply per-user item rolls & rewards
    // Normalize engine logs to DB shape (ensure userId is populated for each row)
    const normalizeAction = (t: string) => {
      if (!t) return 'attack';
      const map: Record<string, string> = {
        attack: 'attack',
        miss: 'attack',
        counter: 'attack',
        combo: 'attack',
        skill: 'skill',
        item: 'item',
        escape: 'escape',
        pet_ability: 'skill', // Treat pet abilities as skills for DB enum compatibility
      };
      return map[t] ?? 'attack';
    };

    const normalizedLogs = (logs || []).map((l: any) => {
      // Handle pet ability logs - they already have userId set to the owner's ID
      if (l.action === 'pet_ability') {
        const userId = l.userId || (users[0]?.id ?? null);

        const effects: string[] = [];
        if (l.details?.effects) {
          effects.push(...l.details.effects);
        }

        return {
          turn: l.turn,
          actionOrder: l.actionOrder,
          action: normalizeAction(l.action),
          userId,
          details: {
            actor: 'pet', // Preserve pet actor type
            actorName: l.details?.actorName || 'Pet',
            petId: l.details?.petId,
            targetName: l.details?.targetName,
            targetIndex: l.details?.targetIndex,
            damage: l.details?.damage,
            damageType: l.details?.damageType,
            isCritical: l.details?.isCritical || false,
            isMiss: l.details?.isMiss || false,
            hpBefore: l.details?.hpBefore,
            hpAfter: l.details?.hpAfter,
            manaBefore: l.details?.manaBefore,
            manaAfter: l.details?.manaAfter,
            description: l.details?.description || '',
            abilityIcon: l.details?.abilityIcon,
            effects,
          },
        };
      }

      // Original logic for player/enemy actions
      const userId = l.actorIsPlayer
        ? l.actorId
        : l.targetIsPlayer
          ? l.targetId
          : (users[0]?.id ?? null);

      const effects: string[] = [];
      if (l.flags) {
        if (l.flags.crit) effects.push('Chí mạng!');
        if (l.flags.lifesteal)
          effects.push(
            `Hút máu +${Math.round(Number(l.flags.lifesteal) || 0)}`,
          );
        if (l.flags.armorPen) effects.push(`Xuyên giáp +${l.flags.armorPen}`);
        if (l.flags.comboIndex)
          effects.push(`Liên kích lần ${l.flags.comboIndex}`);
        if (l.flags.counter) effects.push('Phản kích!');
        if (l.flags.dodge) effects.push('Né tránh!');
      }

      let targetIndex = l.targetIndex;
      if (
        typeof targetIndex === 'undefined' &&
        typeof l.targetId !== 'undefined' &&
        l.targetIsPlayer === false
      ) {
        const idx = internalEnemies.findIndex(
          (e: any) =>
            (e.instanceId && e.instanceId === l.targetId) ||
            e.id === l.targetId,
        );
        if (idx >= 0) targetIndex = idx;
      }

      return {
        turn: l.turn,
        actionOrder: l.actionOrder,
        action: normalizeAction(l.type ?? l.action),
        userId,
        details: {
          actor: l.actorIsPlayer ? 'player' : 'enemy',
          actorName: l.actorName,
          targetName: l.targetName,
          targetIndex,
          damage: l.damage,
          isCritical: !!l.flags?.crit,
          isMiss: !!l.flags?.dodge || (l.type ?? l.action) === 'miss',
          hpBefore: l.hpBefore,
          hpAfter: l.hpAfter,
          manaBefore: l.manaBefore, // ✅ Add mana tracking
          manaAfter: l.manaAfter,
          manaCost: l.manaCost,
          description: l.description,
          effects,
        },
      };
    });

    const savedCombat = await this.combatResultsRepository.save({
      userIds,
      dungeonId: null, // null indicates wildarea/arena (no dungeon)
      result: combatResult.result as CombatResultType,
      duration: 0,
      rewards: combatResult.rewards,
      teamStats: {
        ...finalTeamStats,
        currentHp: combatResult.teamStats.currentHp,
        members: combatResult.teamStats.members,
      },
      logs: normalizedLogs,
      seed: combatResult.seedUsed,
    });

    // Apply per-user rewards if victory
    if (combatResult.result === 'victory') {
      const perUserBase = this.distributeRewardsToUsers(
        {
          experience: combatResult.rewards.experience,
          gold: combatResult.rewards.gold,
          items: [],
        },
        users,
      );
      const perUserItems = this.calculatePerUserItemRewards(
        internalEnemies,
        { dropItems: [] } as any,
        users.length,
      );
      const perUserCombined = perUserBase.map((base: any, idx: number) => ({
        experience: base.experience,
        gold: base.gold,
        items: perUserItems[idx] || [],
      }));

      // Enrich per-user item entries with item names when possible so UI shows names
      if (this.itemsService) {
        for (const userRewards of perUserCombined) {
          if (!Array.isArray(userRewards.items)) continue;
          for (const it of userRewards.items) {
            try {
              const item = await this.itemsService.findOne(it.itemId);
              if (item) it.name = item.name;
            } catch (err) {
              console.warn('Failed to lookup item name for', it.itemId, err);
            }
          }
        }
      }

      (combatResult as any).__perUserCombined = perUserCombined;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const base = perUserBase[i] || { experience: 0, gold: 0, items: [] };
        const items = perUserItems[i] || [];
        const rewardForUser = {
          experience: base.experience,
          gold: base.gold,
          items,
        };
        await this.applyRewards(user, rewardForUser);
      }
    }

    // Update quest progress for wildarea combat
    console.log(
      '🔍 [WILDAREA QUEST DEBUG] Starting quest integration for wildarea combat',
    );
    console.log(
      '🔍 [WILDAREA QUEST DEBUG] Internal enemies:',
      internalEnemies.map((e) => ({
        id: e.id,
        name: e.name,
        hp: e.hp,
        type: e.type,
      })),
    );

    const enemyKills: { enemyType: string; count: number }[] = [];
    const defeatedEnemies = internalEnemies.filter((enemy) => enemy.hp <= 0);

    console.log(
      '🔍 [WILDAREA QUEST DEBUG] Defeated enemies count:',
      defeatedEnemies.length,
    );

    // Group defeated enemies by type for quest tracking
    const enemyTypeCount = new Map<string, number>();
    for (const enemy of defeatedEnemies) {
      // Use monster name instead of type for quest tracking
      // Quest requirements expect monster names like 'slime', 'goblin', not types like 'normal', 'elite'
      const enemyType = enemy.name.toLowerCase();
      enemyTypeCount.set(enemyType, (enemyTypeCount.get(enemyType) || 0) + 1);
      console.log('🔍 [WILDAREA QUEST DEBUG] Processing defeated enemy:', {
        name: enemy.name,
        type: enemy.type,
        enemyType,
      });
    }

    // Convert map to array format expected by quest service
    for (const [enemyType, count] of enemyTypeCount.entries()) {
      enemyKills.push({ enemyType, count });
    }

    console.log(
      '🔍 [WILDAREA QUEST DEBUG] Final enemy kills data:',
      enemyKills,
    );

    // Update quest progress for each user
    for (const user of users) {
      try {
        console.log(
          '🔍 [WILDAREA QUEST DEBUG] Updating quest progress for user:',
          user.id,
        );
        // Update legacy quest system
        await this.questService.updateQuestProgressFromCombat(
          user.id,
          savedCombat.id,
          {
            enemyKills,
            bossDefeated: false, // wildarea doesn't have bosses typically
          },
        );
        // Update story/event system contributions as well
        try {
          await this.storyEventsService.processCombatForUser(
            user.id,
            savedCombat.id,
            {
              enemyKills,
              bossDefeated: false,
              dungeonId: null,
            },
          );
        } catch (e) {
          console.warn(
            'Failed to process story events for user after wildarea combat:',
            e,
          );
        }
        console.log(
          `✅ [WILDAREA QUEST] Successfully updated quest progress for user ${user.id} - defeated ${enemyKills.length} enemy types`,
        );
      } catch (err) {
        console.error(
          `❌ [WILDAREA QUEST] Failed to update quest progress for user ${user.id} after wildarea combat:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Update user HP and Mana after combat
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const finalHp =
        combatResult.teamStats.members[i]?.hp ?? user.stats.currentHp;
      if (finalHp !== user.stats.currentHp) {
        try {
          await this.userStatsService.updateByUserId(user.id, {
            currentHp: finalHp,
          });
        } catch (err) {
          console.warn(
            `Failed to update HP for user ${user.id} after combat:`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      // Persist currentMana after combat (strategic resource management)
      const finalMana = combatResult.finalPlayers[i]?.stats?.currentMana;
      if (finalMana !== undefined && finalMana !== user.stats.currentMana) {
        try {
          await this.userStatsService.updateByUserId(user.id, {
            currentMana: finalMana,
          });
          console.log(
            `✅ [WILDAREA] Persisted mana for user ${user.id}: ${finalMana}/${combatResult.finalPlayers[i]?.stats?.maxMana}`,
          );
        } catch (err) {
          console.warn(
            `Failed to update mana for user ${user.id} after combat:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    const finalResult = {
      id: (savedCombat as any)?.id,
      combatResultId: (savedCombat as any)?.id,
      result: combatResult.result,
      duration: 0,
      rewards: (combatResult as any).__perUserCombined
        ? users.length === 1
          ? (combatResult as any).__perUserCombined[0]
          : {
              aggregated: combatResult.rewards,
              perUser: (combatResult as any).__perUserCombined,
            }
        : combatResult.rewards,
      logs: (savedCombat as any)?.logs ?? combatResult.logs,
      teamStats: combatResult.teamStats,
      enemies: combatResult.enemies || [],
      originalEnemies: combatResult.originalEnemies || [],
    };

    return finalResult;
  }

  private async processTeamCombat(users: User[], dungeon: Dungeon) {
    // Prepare player inputs using derived stats from core attributes
    const playerInputsPromises = users.map(async (u) => {
      const coreAttrs = await this.calculateTotalCoreAttributes(u.id);
      // Get passive skill bonuses
      const skillEffects = await this.skillService.getPlayerSkillEffects(u.id);
      const derivedStats = deriveCombatStats({
        baseAttack: 10,
        baseMaxHp: 100,
        baseDefense: 5,
        ...coreAttrs,
      });
      // Apply skill bonuses to derived stats
      derivedStats.attack += skillEffects.statBonuses.attack || 0;
      derivedStats.defense += skillEffects.statBonuses.defense || 0;
      derivedStats.maxHp += skillEffects.statBonuses.maxHp || 0;
      derivedStats.critRate += skillEffects.statBonuses.critRate || 0;
      derivedStats.critDamage += skillEffects.statBonuses.critDamage || 0;
      derivedStats.dodgeRate += skillEffects.statBonuses.dodgeRate || 0;
      derivedStats.accuracy += skillEffects.statBonuses.accuracy || 0;

      // Get user's active skills
      const userSkills = await this.skillService.getPlayerSkills(u.id);
      console.log(
        `🔍 User ${u.id} (${u.username}) has ${userSkills.length} total skills`,
      );

      const activeSkills = userSkills
        .filter((ps) => {
          if (!ps.skillDefinition) {
            console.warn(
              `⚠️ PlayerSkill ${ps.id} has no skillDefinition relation!`,
            );
            return false;
          }
          // IMPORTANT: Only include EQUIPPED active skills
          if (!ps.isEquipped) {
            console.log(
              `⏭️ Skipping skill ${ps.skillDefinition.name} - not equipped`,
            );
            return false;
          }
          return ps.skillDefinition.skillType === 'active';
        })
        .map((ps) => ({
          id: ps.skillDefinition.skillId,
          name: ps.skillDefinition.name,
          skillType: ps.skillDefinition.skillType,
          manaCost: ps.skillDefinition.manaCost,
          cooldown: ps.skillDefinition.cooldown,
          targetType: ps.skillDefinition.targetType,
          damageType: ps.skillDefinition.damageType,
          damageFormula: ps.skillDefinition.damageFormula,
          healingFormula: ps.skillDefinition.healingFormula,
          effects: ps.skillDefinition.effects,
          level: ps.level,
        }));

      console.log(
        `✅ User ${u.id} has ${activeSkills.length} EQUIPPED active skills:`,
        activeSkills.map((s) => s.name),
      );

      // Initialize currentMana from DB (persisted value), fallback to maxMana for first combat
      const currentMana = u.stats.currentMana ?? derivedStats.maxMana;
      derivedStats.currentMana = currentMana;

      console.log(
        `🔍 [PROCESS TEAM] User ${u.id} (${u.username}) - DB currentMana: ${u.stats.currentMana}, maxMana: ${derivedStats.maxMana}, using: ${currentMana}`,
      );

      // Get active pet and its abilities
      const activePet = await this.petService.getActivePet(u.id);
      let petMetadata = null;

      if (activePet) {
        console.log(`🐾 [PROCESS TEAM] User ${u.id} has active pet:`, {
          id: activePet.id,
          name: activePet.petDefinition?.name,
          level: activePet.level,
          stats: activePet.stats,
          unlockedAbilities: activePet.unlockedAbilities,
        });

        // Fetch pet abilities
        const petAbilities: any[] = [];
        if (
          activePet.unlockedAbilities &&
          activePet.unlockedAbilities.length > 0
        ) {
          const abilityIds = activePet.unlockedAbilities
            .map((id) => parseInt(id, 10))
            .filter((id) => !isNaN(id));

          if (abilityIds.length > 0) {
            const abilityEntities = await this.petAbilityRepository.find({
              where: { id: In(abilityIds) },
            });

            for (const ability of abilityEntities) {
              petAbilities.push({
                id: ability.id,
                name: ability.name,
                type: ability.type,
                description: ability.description,
                effects: ability.effects,
                cooldown: ability.cooldown,
                manaCost: ability.manaCost,
                targetType: ability.targetType,
                icon: ability.icon,
                rarity: ability.rarity,
              });
            }

            console.log(
              `   🎯 Loaded ${petAbilities.length} abilities for pet "${activePet.petDefinition?.name}":`,
              petAbilities.map((a) => a.name),
            );
          }
        }

        // Calculate pet mana (simple system: max mana = 100, starts at 100)
        const petMaxMana = 100;
        const petCurrentMana = petMaxMana; // Pets start with full mana each combat

        petMetadata = {
          id: activePet.id,
          name: activePet.petDefinition?.name || 'Unknown Pet',
          level: activePet.level,
          stats: activePet.stats || {
            strength: 0,
            intelligence: 0,
            dexterity: 0,
            vitality: 0,
            luck: 0,
          },
          abilities: petAbilities,
          abilityCooldowns: activePet.abilityCooldowns || {},
          maxMana: petMaxMana,
          currentMana: petCurrentMana,
        };

        console.log(`   ✅ Pet metadata prepared:`, {
          name: petMetadata.name,
          abilitiesCount: petMetadata.abilities.length,
          maxMana: petMetadata.maxMana,
          currentMana: petMetadata.currentMana,
        });
      } else {
        console.log(`   ❌ User ${u.id} has no active pet`);
      }

      return {
        id: u.id,
        name: u.username,
        isPlayer: true,
        stats: derivedStats,
        currentHp: u.stats.currentHp,
        skills: activeSkills,
        skillCooldowns: {}, // Initialize empty cooldowns
        metadata: petMetadata ? { pet: petMetadata } : undefined, // ← Add pet metadata here!
      };
    });

    const playerInputs = await Promise.all(playerInputsPromises);

    // Build enemies and keep internal copy for rewards. Use a unique
    // instanceId per spawned enemy so engine IDs are unique even when
    // multiple copies of the same monster template are present.
    const internalEnemies: any[] = [];
    let instanceCounter = 1;
    if (
      dungeon.monsterIds &&
      dungeon.monsterCounts &&
      dungeon.monsterCounts.length > 0
    ) {
      for (const monsterCount of dungeon.monsterCounts) {
        const monster = await this.monstersRepository.findOne({
          where: { id: monsterCount.monsterId },
        });
        if (monster) {
          for (let i = 0; i < monsterCount.count; i++) {
            internalEnemies.push({
              // template id (monster type) - used for rewards and display
              id: monster.id,
              // unique instance id used for engine targeting
              instanceId: instanceCounter++,
              name: monster.name,
              hp: monster.baseHp,
              maxHp: monster.baseHp,
              attack: monster.baseAttack,
              defense: monster.baseDefense,
              level: monster.level,
              type: monster.type,
              element: monster.element,
              experienceReward: monster.experienceReward,
              goldReward: monster.goldReward,
              dropItems: monster.dropItems || [],
            });
          }
        }
      }
    }

    if (internalEnemies.length === 0) {
      internalEnemies.push({
        id: 999,
        name: 'Cương thi',
        hp: 100,
        maxHp: 100,
        attack: 15,
        defense: 5,
        level: dungeon.levelRequirement,
        type: 'undead',
        element: 'dark',
        experienceReward: 10,
        goldReward: 5,
        dropItems: [],
      });
    }

    const enemyInputs = internalEnemies.map((en) => ({
      // use unique instanceId as engine id so each spawned copy is distinct
      id: en.instanceId ?? en.id,
      name: en.name,
      isPlayer: false,
      stats: {
        maxHp: en.maxHp,
        attack: en.attack,
        defense: en.defense,
        critRate: 0,
        critDamage: 100,
        lifesteal: 0,
        armorPen: 0,
        dodgeRate: 0,
        accuracy: 0,
        comboRate: 0,
        counterRate: 0,
        maxMana: en.maxHp, // Enemies don't use mana, set to maxHp for consistency
        currentMana: en.maxHp,
      },
      currentHp: en.hp,
    }));

    // Run engine
    const run = runCombat({
      players: playerInputs,
      enemies: enemyInputs,
    });

    // debug: show seed produced by engine
    console.log('Debug - engine seedUsed:', (run as any)?.seedUsed ?? null);

    // Preserve an ORIGINAL copy of internal enemies (initial HP and stats)
    const originalInternalEnemies = internalEnemies.map((e) => ({ ...e }));

    // Update internal enemies HPs from engine result (preserve dropItems etc)
    for (let i = 0; i < internalEnemies.length; i++) {
      internalEnemies[i].hp =
        run.finalEnemies[i]?.currentHp ?? internalEnemies[i].hp;
    }

    // Build final teamStats using derived maxHp
    const finalTeamStats = {
      totalHp: playerInputs.reduce((sum, p) => sum + p.stats.maxHp, 0),
      currentHp: run.finalPlayers.reduce(
        (sum: number, p: any) => sum + (p.currentHp ?? p.stats.maxHp),
        0,
      ),
      members: users.map((user, idx) => ({
        userId: user.id,
        username: user.username,
        hp: run.finalPlayers[idx]?.currentHp ?? user.stats.currentHp,
        maxHp: playerInputs[idx].stats.maxHp,
        currentMana:
          run.finalPlayers[idx]?.stats?.currentMana ??
          playerInputs[idx].stats.currentMana,
        maxMana: playerInputs[idx].stats.maxMana,
      })),
    };

    // Calculate rewards using updated internalEnemies
    const rewards = await this.calculateRewards(
      internalEnemies,
      dungeon,
      run.result,
    );

    // Map engine logs into older format lightly (store engine logs directly)
    const logs = (run.logs as any[]) || [];

    const finalEnemies = internalEnemies.map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      level: enemy.level,
      type: enemy.type,
      element: enemy.element,
    }));

    return {
      result: run.result,
      logs,
      rewards,
      teamStats: finalTeamStats,
      enemies: finalEnemies,
      internalEnemies,
      originalEnemies: originalInternalEnemies,
      finalPlayers: run.finalPlayers, // ✅ ADD: Needed for mana persistence
      // expose the RNG seed used so callers can persist and replay
      seedUsed: (run as any).seedUsed ?? null,
    } as any;
  }

  private getActiveEffects(stats: any): string[] {
    const effects: string[] = [];
    if (stats.critRate > 0) effects.push('crit');
    if (stats.comboRate > 0) effects.push('combo');
    if (stats.counterRate > 0) effects.push('counter');
    if (stats.lifesteal > 0) effects.push('lifesteal');
    if (stats.dodgeRate > 0) effects.push('dodge');
    if (stats.accuracy > 0) effects.push('accuracy');
    if (stats.armorPen > 0) effects.push('armorPen');
    return effects;
  }

  private processPlayerAttack(
    member: any,
    enemy: any,
    targetIndex: number,
    turn: number,
    logs: any[],
  ) {
    const baseDamage = Math.max(1, member.stats.attack - enemy.defense);
    const damage = baseDamage + Math.floor(Math.random() * 10);

    logs.push({
      turn,
      actionOrder: logs.length + 1,
      action: 'attack',
      userId: member.user.id,
      details: {
        actor: 'player',
        actorName: member.user.username,
        targetName: enemy.name,
        targetIndex, // Add target index for multiple enemies with same name
        damage,
        hpBefore: enemy.hp,
        hpAfter: Math.max(0, enemy.hp - damage),
        description: `${member.user.username} tấn công ${enemy.name}${targetIndex !== undefined ? ` #${targetIndex + 1}` : ''} gây ${damage} sát thương`,
      },
    });

    return { damage };
  }

  private processEnemyAttack(
    enemy: any,
    member: any,
    turn: number,
    logs: any[],
  ) {
    const baseDamage = Math.max(1, enemy.attack - member.stats.defense);
    const damage = baseDamage + Math.floor(Math.random() * 5);

    logs.push({
      turn,
      actionOrder: logs.length + 1,
      action: 'attack',
      userId: member.user.id,
      details: {
        actor: 'enemy',
        actorName: enemy.name,
        targetName: member.user.username,
        damage,
        hpBefore: member.hp,
        hpAfter: Math.max(0, member.hp - damage),
        description: `${enemy.name} tấn công ${member.user.username} gây ${damage} sát thương`,
      },
    });

    return { damage };
  }
  private async applyRewards(user: User, rewards: any) {
    user.experience += rewards.experience;
    user.gold += rewards.gold;

    // Auto level up check
    await this.checkAndApplyLevelUp(user);

    // Apply item rewards (with error handling)
    if (rewards.items && rewards.items.length > 0) {
      for (const itemReward of rewards.items) {
        try {
          await this.userItemsService.addItemToUser(
            user.id,
            itemReward.itemId as number,
            (itemReward.quantity as number) || 1,
          );
        } catch (error) {
          // Skip items that don't exist in the database
          console.warn(
            `Skipping item reward - Item ID ${itemReward.itemId} not found:`,
            (error as Error)?.message,
          );
        }
      }
    }

    await this.usersRepository.save(user);
  }

  // Calculate rewards per enemy killed. Supports monster-level drop definitions
  private async calculateRewards(
    enemies: any[],
    dungeon: Dungeon,
    result: string,
  ) {
    const rewards: {
      experience: number;
      gold: number;
      items: Array<{ itemId: number; quantity: number; name?: string }>;
    } = {
      experience: 0,
      gold: 0,
      items: [],
    };

    if (result === 'victory') {
      // Only compute experience and gold in aggregated rewards here.
      // Item drops (monster and dungeon) are handled per-user separately so
      // that each player's luck is independent. This prevents an aggregated
      // item pool from being applied to everyone.
      for (const enemy of enemies) {
        if (!enemy) continue;
        const defeated = typeof enemy.hp === 'number' ? enemy.hp <= 0 : false;
        if (!defeated) continue;

        const exp = Number(
          enemy.experienceReward ?? dungeon.levelRequirement * 10,
        );
        const gold = Number(enemy.goldReward ?? dungeon.levelRequirement * 5);
        rewards.experience += exp;
        rewards.gold += gold;
      }
      // leave rewards.items empty for aggregated result; per-user items will
      // be provided in the perUserCombined structure.
    } else {
      // Non-victory: small consolation
      for (const enemy of enemies) {
        if (!enemy) continue;
        const exp = Math.floor(
          (Number(enemy.experienceReward ?? dungeon.levelRequirement * 2) ||
            0) * 0.2,
        );
        const gold = Math.floor(
          (Number(enemy.goldReward ?? dungeon.levelRequirement * 1) || 0) * 0.2,
        );
        rewards.experience += exp;
        rewards.gold += gold;
      }
    }

    // Enrich item rewards with item names (if ItemsService available)
    if (rewards.items.length > 0 && this.itemsService) {
      for (const it of rewards.items) {
        try {
          const item = await this.itemsService.findOne(it.itemId);
          if (item) it.name = item.name;
        } catch (err) {
          console.warn('Failed to enrich item name for id', it.itemId, err);
        }
      }
    }

    return rewards;
  }

  /**
   * Distribute aggregated rewards among a list of users.
   * - Experience and gold are split as evenly as possible (remainder given to first users)
   * - Items quantities are distributed round-robin one unit at a time to keep fairness
   */
  private distributeRewardsToUsers(
    rewards: {
      experience: number;
      gold: number;
      items: Array<{ itemId: number; quantity: number; name?: string }>;
    },
    users: User[],
  ) {
    const userCount = users.length || 0;
    if (userCount === 0) return [];

    // Initialize per-user reward containers
    const perUser = Array.from({ length: userCount }, () => ({
      experience: 0,
      gold: 0,
      items: [] as Array<{ itemId: number; quantity: number; name?: string }>,
    }));

    // Split experience
    const totalExp = Number(rewards.experience || 0);
    const baseExp = Math.floor(totalExp / userCount);
    let expRemainder = totalExp - baseExp * userCount;
    for (let i = 0; i < userCount; i++) {
      perUser[i].experience = baseExp + (expRemainder > 0 ? 1 : 0);
      if (expRemainder > 0) expRemainder--;
    }

    // Split gold
    const totalGold = Number(rewards.gold || 0);
    const baseGold = Math.floor(totalGold / userCount);
    let goldRemainder = totalGold - baseGold * userCount;
    for (let i = 0; i < userCount; i++) {
      perUser[i].gold = baseGold + (goldRemainder > 0 ? 1 : 0);
      if (goldRemainder > 0) goldRemainder--;
    }

    // Distribute items round-robin by unit
    const items = Array.isArray(rewards.items) ? rewards.items : [];
    for (const it of items) {
      const itemId = Number(it.itemId);
      let qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
      // If qty is zero, treat as 1
      if (qty === 0) qty = 1;

      let assignIndex = 0;
      while (qty > 0) {
        const target = perUser[assignIndex % userCount];
        const existing = target.items.find((x) => x.itemId === itemId);
        if (existing) existing.quantity += 1;
        else target.items.push({ itemId, quantity: 1, name: it.name });

        qty--;
        assignIndex++;
      }
    }

    return perUser;
  }

  /**
   * Roll items independently for each user.
   * For each user:
   *  - Roll dungeon.dropItems once (per user)
   *  - For each defeated enemy in `enemies`, roll that enemy's dropItems independently
   * Returns an array where index corresponds to user index and value is array of item rewards.
   */
  private calculatePerUserItemRewards(
    enemies: Array<any>,
    dungeon: Dungeon,
    userCount: number,
  ) {
    const perUserItems: Array<
      Array<{ itemId: number; quantity: number; name?: string }>
    > = Array.from({ length: userCount }, () => []);

    const processDropListForUser = (
      drops: any[] | undefined,
      userIdx: number,
      isDungeon = false,
    ) => {
      if (!Array.isArray(drops)) return;
      for (const drop of drops) {
        const dropRate = Number((drop as any).dropRate ?? 0);
        if (Math.random() < dropRate) {
          let quantity = 1;
          if (
            (drop as any).minQuantity !== undefined &&
            (drop as any).maxQuantity !== undefined
          ) {
            const minQ = Number((drop as any).minQuantity);
            const maxQ = Number((drop as any).maxQuantity);
            quantity = Math.floor(Math.random() * (maxQ - minQ + 1)) + minQ;
          } else if ((drop as any).quantity !== undefined) {
            quantity = Number((drop as any).quantity) || 1;
          } else {
            // Default behaviour: if called for dungeon rolls, assume 1
            if (isDungeon) quantity = 1;
            else quantity = Math.floor(Math.random() * 3) + 1;
          }

          const itemIdNum = Number((drop as any).itemId);
          const existing = perUserItems[userIdx].find(
            (it) => it.itemId === itemIdNum,
          );
          if (existing) existing.quantity += quantity;
          else
            perUserItems[userIdx].push({
              itemId: itemIdNum,
              quantity,
              name: undefined,
            });
        }
      }
    };

    for (let u = 0; u < userCount; u++) {
      processDropListForUser(
        Array.isArray(dungeon.dropItems) ? dungeon.dropItems : [],
        u,
        true,
      );

      for (const enemy of enemies) {
        if (!enemy) continue;
        const defeated = typeof enemy.hp === 'number' ? enemy.hp <= 0 : false;
        if (!defeated) continue;

        const monsterDrops = Array.isArray(enemy.dropItems)
          ? enemy.dropItems
          : [];
        processDropListForUser(monsterDrops as any[], u, false);
      }
    }

    return perUserItems;
  }

  private async checkAndApplyLevelUp(user: User): Promise<void> {
    let leveledUp = false;
    let levelsGained = 0;

    while (true) {
      // Lấy thông tin level tiếp theo
      const nextLevel = await this.levelsService.getNextLevel(user.level);

      if (!nextLevel) {
        // Đã đạt level tối đa
        break;
      }

      if (user.experience >= nextLevel.experienceRequired) {
        // Level up!
        user.level = nextLevel.level;
        // NOTE: Experience is cumulative, don't subtract it
        // user.experience -= nextLevel.experienceRequired;
        leveledUp = true;
        levelsGained += 1;

        // NOTE: Level bonuses are now calculated on-demand in getTotalStatsWithAllBonuses
        // Do NOT permanently modify base stats in the database

        // Award free attribute points for this level
        const levelData = await this.levelsService.findByLevel(nextLevel.level);
        if (levelData && levelData.attributePointsReward > 0) {
          await this.userStatsService.addFreeAttributePoints(
            user.id,
            levelData.attributePointsReward,
          );
        }

        // Update HP to new max HP after level up
        try {
          await this.userStatsService.updateHpToMax(user.id);
        } catch (err) {
          console.warn(
            'Failed to update HP after level up:',
            err instanceof Error ? err.message : err,
          );
        }
      } else {
        break;
      }
    }

    // Grant skill points for all levels gained (1 per level)
    if (levelsGained > 0) {
      try {
        await this.userStatsService.grantSkillPoints(user.id, levelsGained);
      } catch (err) {
        console.warn(
          'Failed to grant skill points after combat level up:',
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (leveledUp) {
      await this.usersRepository.save(user);
    }
  }

  // Simple repository helpers used by the controller
  async findAll(): Promise<CombatResult[]> {
    return this.combatResultsRepository.find();
  }

  async findOne(id: number): Promise<CombatResult | null> {
    return this.combatResultsRepository.findOne({ where: { id } });
  }

  async findByUser(userId: number): Promise<CombatResult[]> {
    return this.combatResultsRepository.find({
      where: [{ userIds: () => `ARRAY[${userId}]::int[] @> "userIds"` } as any],
    });
  }
}
