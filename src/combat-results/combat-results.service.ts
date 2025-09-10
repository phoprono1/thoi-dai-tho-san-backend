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

    // Lưu kết quả
    await this.combatResultsRepository.save({
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
      for (const user of users) {
        await this.applyRewards(user, combatResult.rewards);
      }
    }

    const finalResult = {
      result: combatResult.result,
      duration,
      rewards: combatResult.rewards,
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

    // Calculate rewards
    const rewards = this.calculateRewards(dungeon, result);

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

  private calculateRewards(dungeon: Dungeon, result: string) {
    if (result === 'victory') {
      const items: Array<{ itemId: number; quantity: number }> = [];

      // Use dungeon's drop items if available
      if (dungeon.dropItems && dungeon.dropItems.length > 0) {
        for (const dropItem of dungeon.dropItems) {
          if (Math.random() < dropItem.dropRate) {
            const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 items
            items.push({ itemId: dropItem.itemId, quantity });
          }
        }
      }
      // No fallback - only give items that are properly defined

      return {
        experience: dungeon.levelRequirement * 10,
        gold: dungeon.levelRequirement * 5,
        items,
      };
    }
    return {
      experience: Math.floor(dungeon.levelRequirement * 2),
      gold: Math.floor(dungeon.levelRequirement * 1),
      items: [],
    };
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
            error.message,
          );
        }
      }
    }

    await this.usersRepository.save(user);
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

  // Other existing methods...
  async findAll() {
    return this.combatResultsRepository.find({
      relations: ['logs'],
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number) {
    return this.combatResultsRepository.findOne({
      where: { id },
      relations: ['logs'],
    });
  }

  async findByUser(userId: number) {
    return this.combatResultsRepository
      .createQueryBuilder('combatResult')
      .where(':userId = ANY(combatResult.userIds)', { userId })
      .leftJoinAndSelect('combatResult.logs', 'logs')
      .orderBy('combatResult.id', 'DESC')
      .getMany();
  }
}
