/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WorldBoss, BossStatus, BossDisplayMode } from './world-boss.entity';
import { BossCombatLog, CombatAction } from './boss-combat-log.entity';
import { BossDamageRanking, RankingType } from './boss-damage-ranking.entity';
import { BossCombatCooldown } from './boss-combat-cooldown.entity';
import { BossSchedule } from './boss-schedule.entity';
import { BossTemplate } from './boss-template.entity';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import { Guild } from '../guild/guild.entity';
import {
  CreateWorldBossDto,
  WorldBossResponseDto,
  AttackBossDto,
  BossCombatResultDto,
  CreateBossFromTemplateDto,
  AssignBossToScheduleDto,
  RemoveBossFromScheduleDto,
} from './world-boss.dto';
import { Mailbox, MailType } from '../mailbox/mailbox.entity';
import { deriveCombatStats } from '../combat-engine/stat-converter';
import { runCombat } from '../combat-engine/engine';
import { CombatActorInput } from '../combat-engine/types';
import { WorldBossGateway } from './world-boss.gateway';
import { SkillService } from '../player-skills/skill.service';

@Injectable()
export class WorldBossService {
  private readonly logger = new Logger(WorldBossService.name);
  private bossTimers = new Map<number, NodeJS.Timeout>();

  constructor(
    @InjectRepository(WorldBoss)
    private worldBossRepository: Repository<WorldBoss>,
    @InjectRepository(BossCombatLog)
    private bossCombatLogRepository: Repository<BossCombatLog>,
    @InjectRepository(BossDamageRanking)
    private bossDamageRankingRepository: Repository<BossDamageRanking>,
    @InjectRepository(BossCombatCooldown)
    private bossCombatCooldownRepository: Repository<BossCombatCooldown>,
    @InjectRepository(BossSchedule)
    private bossScheduleRepository: Repository<BossSchedule>,
    @InjectRepository(BossTemplate)
    private bossTemplateRepository: Repository<BossTemplate>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserStat)
    private userStatRepository: Repository<UserStat>,
    @InjectRepository(Guild)
    private guildRepository: Repository<Guild>,
    @InjectRepository(Mailbox)
    private mailboxRepository: Repository<Mailbox>,
    private dataSource: DataSource,
    private skillService: SkillService,
  ) {}

  // Inject gateway after construction to avoid circular dependency
  private gateway: WorldBossGateway;

  setGateway(gateway: WorldBossGateway) {
    this.gateway = gateway;
  }

  async createBoss(dto: CreateWorldBossDto): Promise<WorldBossResponseDto> {
    const endTime = new Date();
    endTime.setMinutes(endTime.getMinutes() + (dto.durationMinutes || 60));

    // Create boss with new reward structure
    const bossData = {
      name: dto.name,
      description: dto.description,
      maxHp: dto.maxHp,
      currentHp: dto.maxHp,
      level: dto.level,
      stats: dto.stats,
      status: BossStatus.ALIVE,
      displayMode: BossDisplayMode.DAMAGE_BAR,
      spawnCount: 1,
      durationMinutes: dto.durationMinutes || 60,
      endTime,
      scalingConfig: dto.scalingConfig || {
        hpMultiplier: 1.2,
        statMultiplier: 1.15,
        rewardMultiplier: 1.1,
        maxSpawnCount: 10,
      },
      damagePhases: {
        phase1Threshold: 1000000,
        phase2Threshold: 2000000,
        phase3Threshold: 3000000,
        currentPhase: 1,
        totalDamageReceived: 0,
      },
      rewards: {
        individual: {
          top1: { gold: 50000, experience: 25000, items: [] },
          top2: { gold: 30000, experience: 15000, items: [] },
          top3: { gold: 20000, experience: 10000, items: [] },
          top4to10: { gold: 10000, experience: 5000, items: [] },
          top11to30: { gold: 5000, experience: 2500, items: [] },
        },
        guild: {
          top1: { gold: 100000, experience: 50000, items: [] },
          top2to5: { gold: 50000, experience: 25000, items: [] },
          top6to10: { gold: 25000, experience: 12500, items: [] },
        },
      },
      maxCombatTurns: 50,
      image: dto.image, // Add image support
    };

    const boss = this.worldBossRepository.create(bossData);
    const savedBoss = await this.worldBossRepository.save(boss);

    // Start timer for boss duration
    this.startBossTimer(savedBoss.id);

    return this.mapToResponseDto(savedBoss);
  }

  async getCurrentBoss(): Promise<WorldBossResponseDto | null> {
    const boss = await this.worldBossRepository.findOne({
      where: { status: BossStatus.ALIVE },
      order: { createdAt: 'DESC' },
    });

    return boss ? this.mapToResponseDto(boss) : null;
  }

  async attackBoss(
    userId: number,
    dto: AttackBossDto,
  ): Promise<BossCombatResultDto> {
    const boss = await this.getCurrentBoss();
    if (!boss) {
      throw new NotFoundException('No active boss found');
    }

    // Check if boss is still within active time
    if (boss.endTime && new Date() > new Date(boss.endTime)) {
      throw new BadRequestException(
        'Boss event has ended. Combat is no longer available.',
      );
    }

    // Check cooldown
    const cooldown = await this.bossCombatCooldownRepository.findOne({
      where: { bossId: boss.id, userId },
    });

    if (cooldown && new Date() < cooldown.cooldownUntil) {
      const remainingSeconds = Math.ceil(
        (cooldown.cooldownUntil.getTime() - Date.now()) / 1000,
      );
      throw new BadRequestException(
        `Combat on cooldown. ${remainingSeconds} seconds remaining.`,
      );
    }

    // Get user and stats
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
      throw new BadRequestException('User stats not found');
    }

    // Run combat simulation
    const combatResult = await this.runBossCombat(user, userStats, boss);

    // Update cooldown
    await this.updateCombatCooldown(userId, boss.id);

    // Update boss damage and rankings
    await this.updateBossDamage(boss.id, userId, combatResult.totalDamage);

    // Check if boss phase should advance
    await this.checkPhaseAdvancement(boss.id, combatResult.totalDamage);

    // Broadcast updated boss status to all clients
    if (this.gateway) {
      const updatedBoss = await this.getCurrentBoss();
      if (updatedBoss) {
        this.gateway.broadcastBossUpdate(updatedBoss);
      }
    }

    return {
      success: true,
      damage: combatResult.totalDamage,
      bossHpBefore: boss.currentHp,
      bossHpAfter: boss.currentHp, // Boss doesn't lose HP in damage bar mode
      isBossDead: false,
      combatLogs: combatResult.logs,
      currentPhase: combatResult.newPhase,
      totalDamageReceived: combatResult.totalBossDamage,
    };
  }

  private async runBossCombat(
    user: User,
    userStats: UserStat,
    boss: WorldBossResponseDto,
  ) {
    // Convert user stats to combat format using base attributes
    const playerStats = deriveCombatStats({
      // Use base attributes from UserStat
      STR: userStats.strength + userStats.strengthPoints,
      INT: userStats.intelligence + userStats.intelligencePoints,
      DEX: userStats.dexterity + userStats.dexterityPoints,
      VIT: userStats.vitality + userStats.vitalityPoints,
      LUK: userStats.luck + userStats.luckPoints,
    });

    // Set current HP from UserStat
    playerStats.currentMana = playerStats.maxMana;

    // Get user's active skills for combat
    const userSkills = await this.skillService.getPlayerSkills(user.id);
    console.log(
      `🔍 [runBossCombat] User ${user.id} (${user.username}) has ${userSkills.length} total skills`,
    );

    const activeSkills = userSkills
      .filter((ps) => {
        if (!ps.skillDefinition) {
          console.warn(
            `⚠️ PlayerSkill ${ps.id} has no skillDefinition relation!`,
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
      `✅ [runBossCombat] User ${user.id} has ${activeSkills.length} active skills:`,
      activeSkills.map((s) => s.name),
    );

    // Create boss combat stats
    const bossStats = deriveCombatStats({
      // Boss uses high base stats
      baseMaxHp: 999999999, // High HP for damage bar mode
      baseAttack: boss.stats.attack,
      baseDefense: boss.stats.defense,
      // Convert boss stats to attributes
      STR: Math.floor(boss.stats.attack / 10),
      VIT: Math.floor(boss.stats.defense / 10),
      DEX: Math.floor(boss.stats.critRate / 2),
      LUK: Math.floor(boss.stats.critDamage / 20),
      INT: 50, // Default intelligence for boss
    });

    const player: CombatActorInput = {
      id: user.id,
      name: user.username,
      isPlayer: true,
      stats: playerStats,
      currentHp: playerStats.maxHp,
      skills: activeSkills,
      skillCooldowns: {},
    };

    const bossActor: CombatActorInput = {
      id: `boss_${boss.id}`,
      name: boss.name,
      isPlayer: false,
      stats: bossStats,
      currentHp: bossStats.maxHp,
    };

    // Run combat for max 50 turns (boss wins after 50 turns)
    const combatResult = runCombat({
      players: [player],
      enemies: [bossActor],
      maxTurns: boss.maxCombatTurns,
      seed: Date.now(),
    });

    // Calculate total damage dealt to boss
    const totalDamage = combatResult.logs
      .filter((log) => log.actorIsPlayer && log.damage && log.damage > 0)
      .reduce((sum, log) => sum + (log.damage || 0), 0);

    // Get current boss data for phase calculation
    const currentBoss = await this.worldBossRepository.findOne({
      where: { id: boss.id },
    });

    const newTotalDamage =
      (currentBoss?.damagePhases.totalDamageReceived || 0) + totalDamage;
    let newPhase = currentBoss?.damagePhases.currentPhase || 1;

    // Check phase advancement
    if (newTotalDamage >= boss.damagePhases.phase3Threshold && newPhase < 3) {
      newPhase = 3;
    } else if (
      newTotalDamage >= boss.damagePhases.phase2Threshold &&
      newPhase < 2
    ) {
      newPhase = 2;
    }

    return {
      logs: combatResult.logs,
      totalDamage,
      newPhase,
      totalBossDamage: newTotalDamage,
    };
  }

  private async updateCombatCooldown(userId: number, bossId: number) {
    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + 60 * 1000); // 1 minute cooldown

    const existingCooldown = await this.bossCombatCooldownRepository.findOne({
      where: { bossId, userId },
    });

    if (existingCooldown) {
      existingCooldown.lastCombatTime = now;
      existingCooldown.cooldownUntil = cooldownUntil;
      existingCooldown.totalCombats += 1;
      await this.bossCombatCooldownRepository.save(existingCooldown);
    } else {
      const cooldown = this.bossCombatCooldownRepository.create({
        bossId,
        userId,
        lastCombatTime: now,
        cooldownUntil,
        cooldownSeconds: 60,
        totalCombats: 1,
      });
      await this.bossCombatCooldownRepository.save(cooldown);
    }
  }

  private async updateBossDamage(
    bossId: number,
    userId: number,
    damage: number,
  ) {
    // Update individual ranking
    const existingRanking = await this.bossDamageRankingRepository.findOne({
      where: { bossId, userId, rankingType: RankingType.INDIVIDUAL },
    });

    if (existingRanking) {
      existingRanking.totalDamage =
        Number(existingRanking.totalDamage) + Number(damage);
      existingRanking.attackCount = Number(existingRanking.attackCount) + 1;
      existingRanking.lastDamage = Number(damage);
      await this.bossDamageRankingRepository.save(existingRanking);
    } else {
      const ranking = this.bossDamageRankingRepository.create({
        bossId,
        userId,
        rankingType: RankingType.INDIVIDUAL,
        totalDamage: damage,
        attackCount: 1,
        lastDamage: damage,
        rank: 0, // Will be calculated later
      });
      await this.bossDamageRankingRepository.save(ranking);
    }

    // Update guild ranking if user has guild
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['guild'],
    });

    if (user?.guild?.id) {
      const existingGuildRanking =
        await this.bossDamageRankingRepository.findOne({
          where: {
            bossId,
            guildId: user.guild.id,
            rankingType: RankingType.GUILD,
          },
        });

      if (existingGuildRanking) {
        existingGuildRanking.totalDamage =
          Number(existingGuildRanking.totalDamage) + Number(damage);
        existingGuildRanking.attackCount =
          Number(existingGuildRanking.attackCount) + 1;
        existingGuildRanking.lastDamage = Number(damage);
        await this.bossDamageRankingRepository.save(existingGuildRanking);
      } else {
        const guildRanking = this.bossDamageRankingRepository.create({
          bossId,
          userId, // Representative user for guild
          guildId: user.guild.id,
          rankingType: RankingType.GUILD,
          totalDamage: damage,
          attackCount: 1,
          lastDamage: damage,
          rank: 0,
        });
        await this.bossDamageRankingRepository.save(guildRanking);
      }
    }

    // Recalculate rankings
    await this.recalculateRankings(bossId);

    // Broadcast ranking update via WebSocket
    if (this.gateway) {
      await this.gateway.broadcastRankingUpdate(bossId);
    }
  }

  private async checkPhaseAdvancement(bossId: number, newDamage: number) {
    const boss = await this.worldBossRepository.findOne({
      where: { id: bossId },
    });

    if (!boss) return;

    const newTotalDamage = boss.damagePhases.totalDamageReceived + newDamage;
    let newPhase = boss.damagePhases.currentPhase;

    // Check phase advancement
    if (newTotalDamage >= boss.damagePhases.phase3Threshold && newPhase < 3) {
      newPhase = 3;
    } else if (
      newTotalDamage >= boss.damagePhases.phase2Threshold &&
      newPhase < 2
    ) {
      newPhase = 2;
    }

    // Update boss damage phases
    boss.damagePhases.totalDamageReceived = newTotalDamage;
    boss.damagePhases.currentPhase = newPhase;

    await this.worldBossRepository.save(boss);
  }

  private async recalculateRankings(bossId: number) {
    // Recalculate individual rankings
    const individualRankings = await this.bossDamageRankingRepository.find({
      where: { bossId, rankingType: RankingType.INDIVIDUAL },
      order: { totalDamage: 'DESC' },
    });

    for (let i = 0; i < individualRankings.length; i++) {
      individualRankings[i].rank = i + 1;
      await this.bossDamageRankingRepository.save(individualRankings[i]);
    }

    // Recalculate guild rankings
    const guildRankings = await this.bossDamageRankingRepository.find({
      where: { bossId, rankingType: RankingType.GUILD },
      order: { totalDamage: 'DESC' },
    });

    for (let i = 0; i < guildRankings.length; i++) {
      guildRankings[i].rank = i + 1;
      await this.bossDamageRankingRepository.save(guildRankings[i]);
    }
  }

  async getBossRankings(bossId: number) {
    const individualRankings = await this.bossDamageRankingRepository.find({
      where: { bossId, rankingType: RankingType.INDIVIDUAL },
      order: { totalDamage: 'DESC' },
      take: 30,
      relations: ['user'],
    });

    const guildRankings = await this.bossDamageRankingRepository.find({
      where: { bossId, rankingType: RankingType.GUILD },
      order: { totalDamage: 'DESC' },
      take: 10,
    });

    // Format individual rankings
    const formattedIndividual = individualRankings.map((ranking) => ({
      rank: ranking.rank,
      userId: ranking.userId,
      username: ranking.user?.username || 'Unknown',
      totalDamage: ranking.totalDamage,
      attackCount: ranking.attackCount,
      lastDamage: ranking.lastDamage,
    }));

    // Format guild rankings (need to get guild names)
    const formattedGuild = await Promise.all(
      guildRankings.map(async (ranking) => {
        const guild = await this.guildRepository.findOne({
          where: { id: ranking.guildId },
        });
        return {
          rank: ranking.rank,
          guildId: ranking.guildId,
          guildName: guild?.name || 'Unknown Guild',
          totalDamage: ranking.totalDamage,
          attackCount: ranking.attackCount,
          lastDamage: ranking.lastDamage,
        };
      }),
    );

    return {
      individual: formattedIndividual,
      guild: formattedGuild,
    };
  }

  async endBossEvent(boss: WorldBoss) {
    this.logger.log(`Ending boss event: ${boss.name} (ID: ${boss.id})`);

    // Update boss status
    boss.status = BossStatus.DEAD;
    await this.worldBossRepository.save(boss);

    // Distribute rewards
    await this.distributeRewards(boss.id);

    // Clear timers
    const timer = this.bossTimers.get(boss.id);
    if (timer) {
      clearTimeout(timer);
      this.bossTimers.delete(boss.id);
    }
  }

  private async distributeRewards(bossId: number) {
    const boss = await this.worldBossRepository.findOne({
      where: { id: bossId },
    });

    if (!boss) return;

    const rankings = await this.getBossRankings(bossId);

    // Distribute individual rewards
    for (const ranking of rankings.individual) {
      let rewardConfig;

      if (ranking.rank === 1) {
        rewardConfig = boss.rewards.individual.top1;
      } else if (ranking.rank === 2) {
        rewardConfig = boss.rewards.individual.top2;
      } else if (ranking.rank === 3) {
        rewardConfig = boss.rewards.individual.top3;
      } else if (ranking.rank <= 10) {
        rewardConfig = boss.rewards.individual.top4to10;
      } else if (ranking.rank <= 30) {
        rewardConfig = boss.rewards.individual.top11to30;
      } else {
        continue; // No reward for ranks > 30
      }

      await this.sendRewardToMailbox(
        ranking.userId,
        `World Boss Reward - Rank ${ranking.rank}`,
        `Congratulations! You ranked #${ranking.rank} in the ${boss.name} battle!`,
        rewardConfig,
      );
    }

    // Distribute guild rewards
    for (const guildRanking of rankings.guild) {
      let rewardConfig;

      if (guildRanking.rank === 1) {
        rewardConfig = boss.rewards.guild.top1;
      } else if (guildRanking.rank <= 5) {
        rewardConfig = boss.rewards.guild.top2to5;
      } else if (guildRanking.rank <= 10) {
        rewardConfig = boss.rewards.guild.top6to10;
      } else {
        continue;
      }

      // Update guild gold fund directly
      const guild = await this.guildRepository.findOne({
        where: { id: guildRanking.guildId },
      });

      if (guild) {
        guild.goldFund += rewardConfig.gold;
        guild.experience += rewardConfig.experience;
        await this.guildRepository.save(guild);

        // Send notification to all guild members about the guild reward
        const guildMembers = await this.userRepository.find({
          where: { guild: { id: guildRanking.guildId } },
          relations: ['guild'],
        });

        for (const member of guildMembers) {
          await this.sendRewardToMailbox(
            member.id,
            `Guild World Boss Reward - Rank ${guildRanking.rank}`,
            `Your guild "${guild.name}" ranked #${guildRanking.rank} in the ${boss.name} battle!\n\nGuild rewards added:\n- Gold Fund: +${rewardConfig.gold.toLocaleString()}\n- Guild EXP: +${rewardConfig.experience.toLocaleString()}`,
            { gold: 0, experience: 0, items: rewardConfig.items || [] }, // Individual members don't get gold/exp, only items if any
          );
        }
      }
    }
  }

  private async sendRewardToMailbox(
    userId: number,
    title: string,
    content: string,
    rewards: { gold: number; experience: number; items: any[] },
  ) {
    const mailbox = this.mailboxRepository.create({
      userId,
      title,
      content,
      type: MailType.SYSTEM,
      rewards: {
        gold: rewards.gold,
        experience: rewards.experience,
        items: rewards.items,
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    await this.mailboxRepository.save(mailbox);
  }

  private startBossTimer(bossId: number) {
    // Get boss duration from database
    this.worldBossRepository.findOne({ where: { id: bossId } }).then((boss) => {
      if (boss && boss.durationMinutes) {
        const durationMs = boss.durationMinutes * 60 * 1000;
        const timer = setTimeout(async () => {
          await this.handleBossTimeout(bossId);
        }, durationMs);
        this.bossTimers.set(bossId, timer);
      }
    });
  }

  private async handleBossTimeout(bossId: number) {
    const boss = await this.worldBossRepository.findOne({
      where: { id: bossId },
    });

    if (!boss || boss.status !== BossStatus.ALIVE) {
      return;
    }

    await this.endBossEvent(boss);
  }

  // New methods for template-based boss creation
  async createBossFromTemplate(
    dto: CreateBossFromTemplateDto,
  ): Promise<WorldBossResponseDto> {
    const template = await this.bossTemplateRepository.findOne({
      where: { id: dto.templateId },
    });

    if (!template) {
      throw new NotFoundException(
        `Boss template with ID ${dto.templateId} not found`,
      );
    }

    // Validate schedule if provided
    if (dto.scheduleId) {
      const schedule = await this.bossScheduleRepository.findOne({
        where: { id: dto.scheduleId },
      });
      if (!schedule) {
        throw new NotFoundException(
          `Schedule with ID ${dto.scheduleId} not found`,
        );
      }
    }

    const endTime = new Date();
    endTime.setMinutes(endTime.getMinutes() + (dto.durationMinutes || 60));

    // Use template data with possible custom rewards
    const rewards = dto.customRewards || template.defaultRewards;

    const bossData = {
      name: template.name,
      description: template.description,
      maxHp: 999999999, // High HP for damage bar mode
      currentHp: 999999999,
      level: template.level,
      stats: template.stats,
      status: BossStatus.ALIVE,
      displayMode: BossDisplayMode.DAMAGE_BAR,
      spawnCount: 1,
      durationMinutes: dto.durationMinutes || 60,
      endTime,
      scalingConfig: {
        hpMultiplier: 1.2,
        statMultiplier: 1.15,
        rewardMultiplier: 1.1,
        maxSpawnCount: 10,
      },
      damagePhases: {
        ...template.damagePhases,
        currentPhase: 1,
        totalDamageReceived: 0,
      },
      rewards,
      customRewards: dto.customRewards,
      scheduleId: dto.scheduleId,
      templateId: dto.templateId,
      maxCombatTurns: 50,
      image: template.image,
    };

    const boss = this.worldBossRepository.create(bossData);
    const savedBoss = await this.worldBossRepository.save(boss);

    // Start timer for boss duration
    this.startBossTimer(savedBoss.id);

    return this.mapToResponseDto(savedBoss);
  }

  async assignBossToSchedule(
    dto: AssignBossToScheduleDto,
  ): Promise<WorldBossResponseDto> {
    const boss = await this.worldBossRepository.findOne({
      where: { id: dto.bossId },
    });

    if (!boss) {
      throw new NotFoundException(`Boss with ID ${dto.bossId} not found`);
    }

    const schedule = await this.bossScheduleRepository.findOne({
      where: { id: dto.scheduleId },
    });

    if (!schedule) {
      throw new NotFoundException(
        `Schedule with ID ${dto.scheduleId} not found`,
      );
    }

    boss.scheduleId = dto.scheduleId;
    const updatedBoss = await this.worldBossRepository.save(boss);

    return this.mapToResponseDto(updatedBoss);
  }

  async removeBossFromSchedule(
    dto: RemoveBossFromScheduleDto,
  ): Promise<WorldBossResponseDto> {
    const boss = await this.worldBossRepository.findOne({
      where: { id: dto.bossId },
    });

    if (!boss) {
      throw new NotFoundException(`Boss with ID ${dto.bossId} not found`);
    }

    boss.scheduleId = null;
    const updatedBoss = await this.worldBossRepository.save(boss);

    return this.mapToResponseDto(updatedBoss);
  }

  async updateBossRewards(
    bossId: number,
    customRewards: any,
  ): Promise<WorldBossResponseDto> {
    const boss = await this.worldBossRepository.findOne({
      where: { id: bossId },
    });

    if (!boss) {
      throw new NotFoundException(`Boss with ID ${bossId} not found`);
    }

    boss.customRewards = customRewards;
    boss.rewards = customRewards; // Update active rewards
    const updatedBoss = await this.worldBossRepository.save(boss);

    return this.mapToResponseDto(updatedBoss);
  }

  async getBossesWithTemplates(): Promise<any[]> {
    const bosses = await this.worldBossRepository.find({
      relations: ['template', 'schedule'],
      order: { createdAt: 'DESC' },
    });

    return bosses.map((boss) => ({
      ...this.mapToResponseDto(boss),
      template: boss.template,
      schedule: boss.schedule,
    }));
  }

  // Method to manually end boss and distribute rewards (for expired bosses)
  async endExpiredBosses(): Promise<void> {
    const expiredBosses = await this.worldBossRepository.find({
      where: { status: BossStatus.ALIVE },
    });

    for (const boss of expiredBosses) {
      if (boss.endTime && new Date() > boss.endTime) {
        this.logger.log(`Ending expired boss: ${boss.name} (ID: ${boss.id})`);
        await this.endBossEvent(boss);
      }
    }
  }

  // Public method to manually end a specific boss
  async manuallyEndBoss(bossId: number): Promise<boolean> {
    const boss = await this.worldBossRepository.findOne({
      where: { id: bossId, status: BossStatus.ALIVE },
    });

    if (boss) {
      await this.endBossEvent(boss);
      return true;
    }
    return false;
  }

  private mapToResponseDto(boss: WorldBoss): WorldBossResponseDto {
    return {
      id: boss.id,
      name: boss.name,
      description: boss.description,
      maxHp: boss.maxHp,
      currentHp: boss.currentHp,
      level: boss.level,
      stats: boss.stats,
      status: boss.status,
      displayMode: boss.displayMode,
      respawnTime: boss.respawnTime,
      spawnCount: boss.spawnCount,
      durationMinutes: boss.durationMinutes,
      endTime: boss.endTime,
      scheduledStartTime: boss.scheduledStartTime,
      scalingConfig: boss.scalingConfig,
      damagePhases: boss.damagePhases,
      rewards: boss.rewards,
      scheduleId: boss.scheduleId,
      maxCombatTurns: boss.maxCombatTurns,
      image: boss.image,
      createdAt: boss.createdAt,
      updatedAt: boss.updatedAt,
    };
  }

  async deleteBoss(bossId: number): Promise<boolean> {
    try {
      const boss = await this.worldBossRepository.findOne({
        where: { id: bossId },
      });

      if (!boss) {
        return false;
      }

      // Delete related data first
      await this.bossCombatLogRepository.delete({ bossId });
      await this.bossDamageRankingRepository.delete({ bossId });
      await this.bossCombatCooldownRepository.delete({ bossId });

      // Delete the boss
      await this.worldBossRepository.delete({ id: bossId });

      this.logger.log(`Boss ${bossId} deleted successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete boss ${bossId}:`, error);
      return false;
    }
  }

  async updateBoss(
    bossId: number,
    updateData: Partial<CreateWorldBossDto>,
  ): Promise<WorldBossResponseDto> {
    const boss = await this.worldBossRepository.findOne({
      where: { id: bossId },
    });

    if (!boss) {
      throw new NotFoundException('Boss not found');
    }

    // Update boss properties
    if (updateData.name) boss.name = updateData.name;
    if (updateData.description) boss.description = updateData.description;
    if (updateData.level) boss.level = updateData.level;
    if (updateData.maxHp) boss.maxHp = updateData.maxHp;
    if (updateData.stats) boss.stats = updateData.stats;
    if (updateData.durationMinutes)
      boss.durationMinutes = updateData.durationMinutes;
    if (updateData.image) boss.image = updateData.image;

    // Update end time if duration changed
    if (updateData.durationMinutes && boss.scheduledStartTime) {
      const endTime = new Date(boss.scheduledStartTime);
      endTime.setMinutes(endTime.getMinutes() + updateData.durationMinutes);
      boss.endTime = endTime;
    }

    const updatedBoss = await this.worldBossRepository.save(boss);

    // Broadcast update to all clients
    if (this.gateway) {
      const bossDto = this.mapToResponseDto(updatedBoss);
      this.gateway.broadcastBossUpdate(bossDto);
    }

    return this.mapToResponseDto(updatedBoss);
  }
}
