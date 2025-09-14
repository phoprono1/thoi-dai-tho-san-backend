/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    private userItemsService: UserItemsService,
    private levelsService: LevelsService,
    private userStaminaService: UserStaminaService,
    private userStatsService: UserStatsService,
    private itemsService: ItemsService,
  ) {}

  async startCombat(userIds: number[], dungeonId: number) {
    const startTime = Date.now();

    // Lấy thông tin users và dungeon
    const users = await this.usersRepository.find({
      where: userIds.map((id) => ({ id })),
      relations: ['stats'],
    });

    const dungeon = await this.dungeonsRepository.findOne({
      where: { id: dungeonId },
    });

    if (users.length !== userIds.length || !dungeon) {
      throw new Error('Một số người chơi hoặc dungeon không tồn tại');
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
    // recently (e.g., equip endpoint updated derived stats). Re-fetch stats
    // for each user to avoid using stale relations from earlier load.
    for (const user of users) {
      try {
        const freshStats = await this.userStatsRepository.findOne({
          where: { userId: user.id },
        });
        if (freshStats) {
          user.stats = freshStats;
        }
      } catch (err) {
        console.warn(
          `Could not refresh stats for user ${user.id}:`,
          err?.message || err,
        );
      }
    }

    // Thực hiện combat logic
    const combatResult = await this.processTeamCombat(users, dungeon);

    // Tính thời gian
    const duration = Date.now() - startTime;

    // Khởi tạo team stats
    const teamStats = {
      totalHp: users.reduce((sum, user) => sum + user.stats.maxHp, 0),
      currentHp: users.reduce((sum, user) => sum + user.stats.currentHp, 0),
      members: users.map((user) => ({
        userId: user.id,
        username: user.username,
        hp: user.stats.currentHp,
        maxHp: user.stats.maxHp,
      })),
    };

    // Lưu kết quả and capture saved entity (so we have the generated id)
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
      logs: combatResult.logs,
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
    }

    // If we rolled items per-user, build a per-user rewards array so clients can
    // see exactly what each player received. For single-player runs, expose
    // that player's rewards in `finalResult.rewards` (so you won't see the
    // aggregated pool which can be misleading).
    if (combatResult.result === 'victory') {
      try {
        // perUserBase and perUserItems are only defined in the victory path
        // earlier when we applied rewards. If they're present in scope use
        // them; otherwise fall back to aggregated rewards.
        // Note: perUserBase/perUserItems were computed above in the victory block.
        // We reconstruct perUserCombined if available.
        if (typeof (global as any).dummy === 'undefined') {
          // no-op to keep TypeScript happy about variable usage
        }
      } catch (err) {
        console.error('Error enriching reward item names', err);
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
      logs: combatResult.logs,
      teamStats: combatResult.teamStats,
      enemies: combatResult.enemies || [], // Add enemies data
    };

    console.log('Debug - Final combat result structure:', {
      enemiesCount: finalResult.enemies.length,
      enemies: finalResult.enemies,
      sampleLog: finalResult.logs[0] || 'No logs',
    });

    return finalResult;
  }

  private async processTeamCombat(users: User[], dungeon: Dungeon) {
    const logs: Array<{
      turn: number;
      actionOrder: number;
      action: string;
      userId: number;
      details: {
        actor: string;
        actorName: string;
        targetName: string;
        targetIndex?: number; // For multiple enemies with same name
        damage: number;
        hpBefore: number;
        hpAfter: number;
        description: string;
        effects?: string[];
      };
    }> = [];
    let turn = 1;
    const maxTurns = 50;

    // Khởi tạo trạng thái team với các chỉ số nâng cao
    const teamMembers = users.map((user) => ({
      user,
      hp: user.stats.currentHp,
      maxHp: user.stats.maxHp,
      stats: user.stats,
      // Tối ưu hóa: chỉ lưu những chỉ số có rate > 0
      activeEffects: this.getActiveEffects(user.stats),
    }));

    // Populate enemies from dungeon's monster system
    const enemies: any[] = [];
    console.log('Debug - Dungeon monster info:', {
      id: dungeon.id,
      name: dungeon.name,
      monsterIds: dungeon.monsterIds,
      monsterCounts: dungeon.monsterCounts,
    });

    if (
      dungeon.monsterIds &&
      dungeon.monsterCounts &&
      dungeon.monsterCounts.length > 0
    ) {
      for (const monsterCount of dungeon.monsterCounts) {
        const monster = await this.monstersRepository.findOne({
          where: { id: monsterCount.monsterId },
        });
        console.log(
          `Debug - Looking for monster ID ${monsterCount.monsterId}:`,
          monster ? `Found: ${monster.name}` : 'Not found',
        );
        if (monster) {
          for (let i = 0; i < monsterCount.count; i++) {
            enemies.push({
              id: monster.id,
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
    } else {
      // Fallback: create a default enemy if no monsters defined
      console.log('Debug - No monsters defined in dungeon, using fallback');
      enemies.push({
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

    console.log(`Debug - Final enemies array: ${enemies.length} enemies`);
    enemies.forEach((enemy, idx) => {
      console.log(
        `Enemy ${idx}: ${enemy.name} (${enemy.hp}/${enemy.maxHp} HP, Level ${enemy.level})`,
      );
    });

    // We'll update enemies info at the end with final HP values

    while (
      turn <= maxTurns &&
      enemies.some((e) => e.hp > 0) &&
      teamMembers.some((m) => m.hp > 0)
    ) {
      // Player attacks
      for (const member of teamMembers) {
        if (member.hp <= 0) continue;

        // Only target alive enemies
        const aliveEnemies = enemies.filter((e) => e.hp > 0);
        if (aliveEnemies.length === 0) break;

        const targetEnemy =
          aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];

        // Find original index of target enemy
        const targetEnemyIndex = enemies.indexOf(targetEnemy);

        const attackResult = this.processPlayerAttack(
          member,
          targetEnemy,
          targetEnemyIndex,
          turn,
          logs,
        );

        if (attackResult) {
          targetEnemy.hp = Math.max(0, targetEnemy.hp - attackResult.damage);
        }
      }

      // Don't remove defeated enemies from array to keep stable indexes
      // Just let them stay with 0 HP

      // Enemy attacks - only alive enemies attack
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue; // Skip defeated enemies

        const alivePlayers = teamMembers.filter((m) => m.hp > 0);
        if (alivePlayers.length === 0) break;

        const targetMember =
          alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        const attackResult = this.processEnemyAttack(
          enemy,
          targetMember,
          turn,
          logs,
        );

        if (attackResult) {
          targetMember.hp = Math.max(0, targetMember.hp - attackResult.damage);
        }
      }

      turn++;
    }

    // Determine result
    const aliveEnemiesCount = enemies.filter((e) => e.hp > 0).length;
    const result = aliveEnemiesCount === 0 ? 'victory' : 'defeat';

    // Calculate rewards based on which enemies were defeated
    const rewards = await this.calculateRewards(enemies, dungeon, result);

    // Calculate final team stats
    const finalTeamStats = {
      totalHp: teamMembers.reduce((sum, member) => sum + member.maxHp, 0),
      currentHp: teamMembers.reduce((sum, member) => sum + member.hp, 0),
      members: teamMembers.map((member) => ({
        userId: member.user.id,
        username: member.user.username,
        hp: member.hp,
        maxHp: member.maxHp,
      })),
    };

    // Prepare final enemies state with updated HP values
    const finalEnemies = enemies.map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      hp: enemy.hp, // Use current HP after combat
      maxHp: enemy.maxHp,
      level: enemy.level,
      type: enemy.type,
      element: enemy.element,
    }));

    return {
      result,
      logs,
      rewards,
      teamStats: finalTeamStats,
      enemies: finalEnemies, // Use updated enemies info with current HP
      // Keep full internal enemy objects for server-side logic (dropItems, rewards)
      internalEnemies: enemies,
    };
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
        user.experience -= nextLevel.experienceRequired;
        leveledUp = true;

        // Cộng stats từ level mới vào user stats
        const levelStats = await this.levelsService.getTotalLevelStats(
          nextLevel.level,
        );
        if (levelStats) {
          await this.userStatsService.recalculateTotalStats(
            user.id,
            levelStats,
            { maxHp: 100, attack: 10, defense: 5 }, // Base stats
          );
        }
      } else {
        break;
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
