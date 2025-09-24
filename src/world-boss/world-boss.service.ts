/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @types      // Determine combat action
      const action = this.determineCombatAction(derivedStats);ipt-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WorldBoss, BossStatus } from './world-boss.entity';
import { BossCombatLog, CombatAction } from './boss-combat-log.entity';
import { BossDamageRanking, RankingType } from './boss-damage-ranking.entity';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import {
  CreateWorldBossDto,
  WorldBossResponseDto,
  AttackBossDto,
  BossCombatResultDto,
} from './world-boss.dto';
import { Mailbox, MailType } from '../mailbox/mailbox.entity';
import { deriveCombatStats } from '../combat-engine/stat-converter';

@Injectable()
export class WorldBossService {
  private bossTimers = new Map<number, NodeJS.Timeout>();

  constructor(
    @InjectRepository(WorldBoss)
    private worldBossRepository: Repository<WorldBoss>,
    @InjectRepository(BossCombatLog)
    private bossCombatLogRepository: Repository<BossCombatLog>,
    @InjectRepository(BossDamageRanking)
    private bossDamageRankingRepository: Repository<BossDamageRanking>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserStat)
    private userStatRepository: Repository<UserStat>,
    @InjectRepository(Mailbox)
    private mailboxRepository: Repository<Mailbox>,
    private dataSource: DataSource,
  ) {}

  async createBoss(dto: CreateWorldBossDto): Promise<WorldBossResponseDto> {
    const endTime = new Date();
    endTime.setMinutes(endTime.getMinutes() + (dto.durationMinutes || 60));

    const boss = this.worldBossRepository.create({
      ...dto,
      currentHp: dto.maxHp,
      status: BossStatus.ALIVE,
      spawnCount: 1,
      endTime,
      scalingConfig: dto.scalingConfig || {
        hpMultiplier: 1.2,
        statMultiplier: 1.15,
        rewardMultiplier: 1.1,
        maxSpawnCount: 10,
      },
    });

    const savedBoss = await this.worldBossRepository.save(boss);

    // Start timer for boss duration
    this.startBossTimer(savedBoss.id);

    return this.mapToResponseDto(savedBoss);
  }

  private startBossTimer(bossId: number) {
    const timer = setTimeout(
      async () => {
        await this.handleBossTimeout(bossId);
      },
      60 * 60 * 1000,
    ); // 1 hour

    this.bossTimers.set(bossId, timer);
  }

  private async handleBossTimeout(bossId: number) {
    const boss = await this.worldBossRepository.findOne({
      where: { id: bossId },
    });

    if (!boss || boss.status !== BossStatus.ALIVE) {
      return;
    }

    // Boss timeout - force defeat and respawn
    await this.forceBossDefeat(boss);
  }

  private async forceBossDefeat(boss: WorldBoss) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      boss.status = BossStatus.DEAD;
      boss.currentHp = 0;

      await queryRunner.manager.save(boss);

      // Distribute rewards for timeout
      // const rewards = await this.distributeRewards(queryRunner, boss.id);

      // Respawn with scaling
      await this.respawnBossWithScaling(queryRunner, boss);

      await queryRunner.commitTransaction();

      // Broadcast boss defeat due to timeout
      // await this.worldBossGateway.broadcastBossDefeat(
      //   boss.id,
      //   new Date(Date.now() + 30000),
      //   rewards,
      // );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async respawnBossWithScaling(queryRunner: any, oldBoss: WorldBoss) {
    const newSpawnCount = oldBoss.spawnCount + 1;

    // Check if reached max spawn count
    if (newSpawnCount > oldBoss.scalingConfig.maxSpawnCount) {
      // Boss permanently defeated
      return;
    }

    const scaledBoss = queryRunner.manager.create(WorldBoss, {
      name: `${oldBoss.name} (Wave ${newSpawnCount})`,
      description: oldBoss.description,
      maxHp: Math.floor(oldBoss.maxHp * oldBoss.scalingConfig.hpMultiplier),
      currentHp: Math.floor(oldBoss.maxHp * oldBoss.scalingConfig.hpMultiplier),
      level: oldBoss.level,
      stats: {
        attack: Math.floor(
          oldBoss.stats.attack * oldBoss.scalingConfig.statMultiplier,
        ),
        defense: Math.floor(
          oldBoss.stats.defense * oldBoss.scalingConfig.statMultiplier,
        ),
        critRate: oldBoss.stats.critRate,
        critDamage: oldBoss.stats.critDamage,
      },
      status: BossStatus.ALIVE,
      spawnCount: newSpawnCount,
      durationMinutes: oldBoss.durationMinutes,
      endTime: new Date(Date.now() + oldBoss.durationMinutes * 60 * 1000),
      scalingConfig: oldBoss.scalingConfig,
      rewards: {
        gold: Math.floor(
          oldBoss.rewards.gold * oldBoss.scalingConfig.rewardMultiplier,
        ),
        experience: Math.floor(
          oldBoss.rewards.experience * oldBoss.scalingConfig.rewardMultiplier,
        ),
        items: oldBoss.rewards.items,
      },
    });

    const savedBoss = await queryRunner.manager.save(scaledBoss);

    // Start new timer
    this.startBossTimer(savedBoss.id);

    // Reset rankings for new boss
    await this.resetRankingsForNewBoss(queryRunner, savedBoss.id);

    // Broadcast new boss spawn
    // await this.worldBossGateway.broadcastNewBossSpawn(
    //   this.mapToResponseDto(savedBoss),
    // );

    return savedBoss;
  }

  private async resetRankingsForNewBoss(queryRunner: any, bossId: number) {
    // Clear old rankings for new boss wave
    await queryRunner.manager.delete(BossDamageRanking, { bossId });
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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get current boss
      const boss = await queryRunner.manager.findOne(WorldBoss, {
        where: { status: BossStatus.ALIVE },
      });

      if (!boss) {
        throw new NotFoundException('No active world boss found');
      }

      if (boss.status !== BossStatus.ALIVE) {
        throw new BadRequestException('Boss is not available for attack');
      }

      // Get user and stats
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        relations: ['guild'],
      });

      const userStats = await queryRunner.manager.findOne(UserStat, {
        where: { userId },
      });

      if (!user || !userStats) {
        throw new NotFoundException('User or user stats not found');
      }

      // Calculate damage based on user's HP percentage
      const coreAttrs = {
        strength: userStats.strength || 0,
        intelligence: userStats.intelligence || 0,
        dexterity: userStats.dexterity || 0,
        vitality: userStats.vitality || 0,
        luck: userStats.luck || 0,
      };
      const derivedStats = deriveCombatStats({
        baseAttack: 10,
        baseMaxHp: 100,
        baseDefense: 5,
        ...coreAttrs,
      });
      const hpPercentage = (userStats.currentHp / derivedStats.maxHp) * 100;
      const actualDamage = Math.floor(dto.damage * (hpPercentage / 100));

      // Ensure damage doesn't exceed boss HP
      const finalDamage = Math.min(actualDamage, boss.currentHp);
      const newBossHp = boss.currentHp - finalDamage;

      // Determine combat action
      const action = this.determineCombatAction(derivedStats);

      // Create combat log
      const combatLog = queryRunner.manager.create(BossCombatLog, {
        userId,
        bossId: boss.id,
        action,
        damage: finalDamage,
        bossHpBefore: boss.currentHp,
        bossHpAfter: newBossHp,
        playerStats: {
          attack: derivedStats.attack,
          defense: derivedStats.defense,
          critRate: derivedStats.critRate,
          critDamage: derivedStats.critDamage,
          currentHp: userStats.currentHp,
          maxHp: derivedStats.maxHp,
        },
        bossStats: {
          attack: boss.stats.attack,
          defense: boss.stats.defense,
          currentHp: boss.currentHp,
          maxHp: boss.maxHp,
        },
      });

      await queryRunner.manager.save(combatLog);

      // Update boss HP
      let isBossDead = false;
      let rewards: any = null;

      if (newBossHp <= 0) {
        // Boss defeated
        boss.status = BossStatus.DEAD;
        boss.currentHp = 0;
        isBossDead = true;

        // Distribute rewards
        rewards = await this.distributeRewards(queryRunner, boss.id);

        // Respawn with scaling after 30 seconds
        setTimeout(() => {
          void this.respawnBossWithScaling(queryRunner, boss);
        }, 30000);
      } else {
        boss.currentHp = newBossHp;
      }

      await queryRunner.manager.save(boss);

      // Update damage rankings
      await this.updateDamageRanking(
        queryRunner,
        userId,
        boss.id,
        finalDamage,
        user.guild?.id,
      );

      await queryRunner.commitTransaction();

      // Broadcast boss update to all connected clients
      // const currentBoss = await this.worldBossRepository.findOne({
      //   where: { status: BossStatus.ALIVE },
      // });
      // if (currentBoss) {
      //   await this.worldBossGateway.broadcastBossUpdate(
      //     this.mapToResponseDto(currentBoss),
      //   );
      // }

      return {
        success: true,
        damage: finalDamage,
        bossHpBefore: boss.currentHp,
        bossHpAfter: newBossHp,
        isBossDead,
        rewards,
        nextRespawnTime: isBossDead ? new Date(Date.now() + 30000) : undefined,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private determineCombatAction(derivedStats: any): CombatAction {
    const critChance = derivedStats.critRate / 100;
    const missChance = 0.05; // 5% miss chance

    const random = Math.random();

    if (random < missChance) {
      return CombatAction.MISS;
    } else if (random < critChance) {
      return CombatAction.CRIT;
    } else {
      return CombatAction.ATTACK;
    }
  }

  private async updateDamageRanking(
    queryRunner: any,
    userId: number,
    bossId: number,
    damage: number,
    guildId?: number,
  ) {
    // Update individual ranking
    let individualRanking = await queryRunner.manager.findOne(
      BossDamageRanking,
      {
        where: { bossId, userId, rankingType: RankingType.INDIVIDUAL },
      },
    );

    if (!individualRanking) {
      individualRanking = queryRunner.manager.create(BossDamageRanking, {
        bossId,
        userId,
        rankingType: RankingType.INDIVIDUAL,
        totalDamage: 0,
        attackCount: 0,
      });
    }

    individualRanking.totalDamage += damage;
    individualRanking.attackCount += 1;
    individualRanking.lastDamage = damage;

    await queryRunner.manager.save(individualRanking);

    // Update guild ranking if user has guild
    if (guildId) {
      let guildRanking = await queryRunner.manager.findOne(BossDamageRanking, {
        where: { bossId, userId: guildId, rankingType: RankingType.GUILD },
      });

      if (!guildRanking) {
        guildRanking = queryRunner.manager.create(BossDamageRanking, {
          bossId,
          userId: guildId,
          guildId,
          rankingType: RankingType.GUILD,
          totalDamage: 0,
          attackCount: 0,
        });
      }

      guildRanking.totalDamage += damage;
      guildRanking.attackCount += 1;

      await queryRunner.manager.save(guildRanking);
    }
  }

  private async distributeRewards(
    queryRunner: any,
    bossId: number,
  ): Promise<any> {
    // Get top 10 individual contributors
    const topIndividuals = await queryRunner.manager.find(BossDamageRanking, {
      where: { bossId, rankingType: RankingType.INDIVIDUAL },
      order: { totalDamage: 'DESC' },
      take: 10,
      relations: ['user'],
    });

    // Get top 5 guilds
    const topGuilds = await queryRunner.manager.find(BossDamageRanking, {
      where: { bossId, rankingType: RankingType.GUILD },
      order: { totalDamage: 'DESC' },
      take: 5,
    });

    // Send rewards via mailbox
    for (const ranking of topIndividuals) {
      const rank = topIndividuals.indexOf(ranking) + 1;
      const reward = this.calculateIndividualReward(rank, ranking.totalDamage);

      await queryRunner.manager.create(Mailbox, {
        userId: ranking.userId,
        title: `World Boss Reward - Rank ${rank}`,
        content: `Congratulations! You ranked ${rank} in the World Boss battle with ${ranking.totalDamage} total damage.`,
        type: MailType.REWARD,
        rewards: reward,
      });
    }

    return {
      topIndividuals: topIndividuals.length,
      topGuilds: topGuilds.length,
    };
  }

  private calculateIndividualReward(rank: number, totalDamage: number): any {
    const baseGold = 1000;
    const baseExp = 500;

    const multipliers = [5, 3, 2, 1.5, 1.2, 1, 0.8, 0.6, 0.4, 0.2];
    const multiplier = multipliers[rank - 1] || 0.1;

    return {
      gold: Math.floor(baseGold * multiplier),
      experience: Math.floor(baseExp * multiplier),
      items: [], // Could add items based on rank
    };
  }

  async getBossRankings(bossId: number): Promise<any> {
    const individualRankings = await this.bossDamageRankingRepository.find({
      where: { bossId, rankingType: RankingType.INDIVIDUAL },
      order: { totalDamage: 'DESC' },
      take: 50,
      relations: ['user'],
    });

    const guildRankings = await this.bossDamageRankingRepository.find({
      where: { bossId, rankingType: RankingType.GUILD },
      order: { totalDamage: 'DESC' },
      take: 20,
    });

    return {
      individual: individualRankings.map((r, index) => ({
        rank: index + 1,
        username: r.user.username,
        totalDamage: r.totalDamage,
        attackCount: r.attackCount,
      })),
      guild: guildRankings.map((r, index) => ({
        rank: index + 1,
        guildId: r.guildId,
        totalDamage: r.totalDamage,
        attackCount: r.attackCount,
      })),
    };
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
      spawnCount: boss.spawnCount,
      durationMinutes: boss.durationMinutes,
      endTime: boss.endTime,
      scalingConfig: boss.scalingConfig,
      rewards: boss.rewards,
      createdAt: boss.createdAt,
      updatedAt: boss.updatedAt,
    };
  }
}
