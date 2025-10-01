import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PvpRanking,
  PvpSeason,
  PvpMatch,
  HunterRank,
  calculateRank,
  calculateEloChange,
  RANK_THRESHOLDS,
} from './entities';
import { User } from '../users/user.entity';
import { UserStatsService } from '../user-stats/user-stats.service';
import { runCombat } from '../combat-engine/engine';
import { CombatActorInput } from '../combat-engine/types';
import { deriveCombatStats } from '../combat-engine/stat-converter';
import { MailboxService } from '../mailbox/mailbox.service';
import { MailType } from '../mailbox/mailbox.entity';

@Injectable()
export class PvpRankingService {
  private readonly logger = new Logger(PvpRankingService.name);
  constructor(
    @InjectRepository(PvpRanking)
    private pvpRankingRepository: Repository<PvpRanking>,
    @InjectRepository(PvpSeason)
    private pvpSeasonRepository: Repository<PvpSeason>,
    @InjectRepository(PvpMatch)
    private pvpMatchRepository: Repository<PvpMatch>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private userStatsService: UserStatsService,
    private mailboxService: MailboxService,
  ) {}

  // Get current active season
  async getCurrentSeason(): Promise<PvpSeason> {
    const season = await this.pvpSeasonRepository.findOne({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });

    if (!season) {
      throw new NotFoundException('No active PvP season found');
    }

    return season;
  }

  // Get or create user ranking for current season
  async getUserRanking(userId: number): Promise<PvpRanking> {
    const season = await this.getCurrentSeason();

    let ranking = await this.pvpRankingRepository.findOne({
      where: { userId, seasonId: season.id },
      relations: ['user', 'season'],
    });

    if (!ranking) {
      // Create new ranking for user
      ranking = this.pvpRankingRepository.create({
        userId,
        seasonId: season.id,
        hunterPoints: 1200, // Starting ELO
        currentRank: HunterRank.APPRENTICE,
      });
      ranking = await this.pvpRankingRepository.save(ranking);

      // Load relations
      ranking = await this.pvpRankingRepository.findOne({
        where: { id: ranking.id },
        relations: ['user', 'season'],
      });
    }

    // Ensure calculated properties are included
    return {
      ...ranking,
      rankName: ranking.rankName,
      winRate: ranking.winRate,
      canRefreshOpponents: ranking.canRefreshOpponents,
      canFight: ranking.canFight,
    } as PvpRanking;
  }

  // Get potential opponents (5 random players with similar rating)
  async getPotentialOpponents(userId: number): Promise<PvpRanking[]> {
    const userRanking = await this.getUserRanking(userId);

    // No cooldown check - always allow viewing opponents

    const pointsRange = 200; // ±200 points range
    const minPoints = Math.max(0, userRanking.hunterPoints - pointsRange);
    const maxPoints = userRanking.hunterPoints + pointsRange;

    const opponents = await this.pvpRankingRepository
      .createQueryBuilder('ranking')
      .leftJoinAndSelect('ranking.user', 'user')
      .where('ranking.seasonId = :seasonId', { seasonId: userRanking.seasonId })
      .andWhere('ranking.userId != :userId', { userId })
      .andWhere('ranking.hunterPoints BETWEEN :minPoints AND :maxPoints', {
        minPoints,
        maxPoints,
      })
      .orderBy('RANDOM()')
      .limit(5)
      .getMany();

    // No need to update refresh timestamp since there's no cooldown
    // Ensure calculated properties are included for opponents
    return opponents.map((opponent) => ({
      ...opponent,
      rankName: opponent.rankName,
      winRate: opponent.winRate,
      canRefreshOpponents: opponent.canRefreshOpponents,
      canFight: opponent.canFight,
    }));
  }

  // Challenge another player
  async challengePlayer(
    challengerId: number,
    defenderId: number,
  ): Promise<PvpMatch> {
    const challengerRanking = await this.getUserRanking(challengerId);
    const defenderRanking = await this.getUserRanking(defenderId);

    // Check cooldown (skip for first time)
    if (challengerRanking.lastMatchAt && !challengerRanking.canFight) {
      const remainingTime = Math.ceil(
        (60000 -
          (new Date().getTime() - challengerRanking.lastMatchAt.getTime())) /
          1000,
      );
      throw new BadRequestException(
        `You must wait ${remainingTime} seconds between matches`,
      );
    }

    if (challengerId === defenderId) {
      throw new BadRequestException('You cannot challenge yourself');
    }

    // Get user stats for combat
    const challengerStats =
      await this.userStatsService.getTotalStatsWithAllBonuses(challengerId);
    const defenderStats =
      await this.userStatsService.getTotalStatsWithAllBonuses(defenderId);

    // Use proper stat converter for combat stats
    const challengerCombatStats = deriveCombatStats({
      strength: challengerStats.str,
      intelligence: challengerStats.int,
      dexterity: challengerStats.dex,
      vitality: challengerStats.vit,
      luck: challengerStats.luk,
    });

    const defenderCombatStats = deriveCombatStats({
      strength: defenderStats.str,
      intelligence: defenderStats.int,
      dexterity: defenderStats.dex,
      vitality: defenderStats.vit,
      luck: defenderStats.luk,
    });

    // Prepare combat actors
    const challenger: CombatActorInput = {
      id: challengerId,
      name: challengerRanking.user.username,
      isPlayer: true,
      stats: challengerCombatStats,
    };

    const defender: CombatActorInput = {
      id: defenderId,
      name: defenderRanking.user.username,
      isPlayer: false, // Treat as enemy for combat engine
      stats: defenderCombatStats,
    };

    // Run combat
    const combatSeed = Math.floor(Math.random() * 1000000);
    const combatResult = runCombat({
      players: [challenger],
      enemies: [defender],
      maxTurns: 50,
      seed: combatSeed,
    });

    const isWin = combatResult.result === 'victory';
    const winnerId = isWin ? challengerId : defenderId;

    // Calculate ELO changes
    const challengerPointsChange = calculateEloChange(
      challengerRanking.hunterPoints,
      defenderRanking.hunterPoints,
      isWin,
    );
    const defenderPointsChange = -challengerPointsChange;

    // Update rankings
    const newChallengerPoints = Math.max(
      0,
      challengerRanking.hunterPoints + challengerPointsChange,
    );
    const newDefenderPoints = Math.max(
      0,
      defenderRanking.hunterPoints + defenderPointsChange,
    );

    // Create match record
    const match = this.pvpMatchRepository.create({
      challengerId,
      defenderId,
      seasonId: challengerRanking.seasonId,
      winnerId,
      challengerPointsBefore: challengerRanking.hunterPoints,
      defenderPointsBefore: defenderRanking.hunterPoints,
      challengerPointsAfter: newChallengerPoints,
      defenderPointsAfter: newDefenderPoints,
      pointsChange: challengerPointsChange,
      combatResult,
      combatSeed,
    });

    const savedMatch = await this.pvpMatchRepository.save(match);

    // Update challenger ranking
    challengerRanking.hunterPoints = newChallengerPoints;
    challengerRanking.currentRank = calculateRank(newChallengerPoints);
    challengerRanking.totalMatches += 1;
    challengerRanking.lastMatchAt = new Date();
    challengerRanking.highestPoints = Math.max(
      challengerRanking.highestPoints,
      newChallengerPoints,
    );

    if (isWin) {
      challengerRanking.wins += 1;
      challengerRanking.winStreak += 1;
      challengerRanking.bestWinStreak = Math.max(
        challengerRanking.bestWinStreak,
        challengerRanking.winStreak,
      );
    } else {
      challengerRanking.losses += 1;
      challengerRanking.winStreak = 0;
    }

    // Update defender ranking
    defenderRanking.hunterPoints = newDefenderPoints;
    defenderRanking.currentRank = calculateRank(newDefenderPoints);
    defenderRanking.totalMatches += 1;
    defenderRanking.highestPoints = Math.max(
      defenderRanking.highestPoints,
      newDefenderPoints,
    );

    if (!isWin) {
      defenderRanking.wins += 1;
      defenderRanking.winStreak += 1;
      defenderRanking.bestWinStreak = Math.max(
        defenderRanking.bestWinStreak,
        defenderRanking.winStreak,
      );
    } else {
      defenderRanking.losses += 1;
      defenderRanking.winStreak = 0;
    }

    await this.pvpRankingRepository.save([challengerRanking, defenderRanking]);

    this.logger.log(
      `PvP Match: ${challengerRanking.user.username} vs ${defenderRanking.user.username} - Winner: ${winnerId === challengerId ? 'Challenger' : 'Defender'}`,
    );

    return savedMatch;
  }

  // Get leaderboard
  async getLeaderboard(
    seasonId?: number,
    limit: number = 100,
  ): Promise<PvpRanking[]> {
    const season = seasonId
      ? await this.pvpSeasonRepository.findOne({ where: { id: seasonId } })
      : await this.getCurrentSeason();

    if (!season) {
      throw new NotFoundException('Season not found');
    }

    const leaderboard = await this.pvpRankingRepository.find({
      where: { seasonId: season.id },
      relations: ['user'],
      order: { hunterPoints: 'DESC' },
      take: limit,
    });

    // Filter out rankings with null users (orphaned records from deleted accounts)
    const validLeaderboard = leaderboard.filter((ranking) => {
      if (!ranking.user) {
        this.logger.warn(
          `Found orphaned PvP ranking ${ranking.id} with null user (userId: ${ranking.userId})`,
        );
        return false;
      }
      return true;
    });

    // Ensure calculated properties are included
    return validLeaderboard.map((ranking) => ({
      ...ranking,
      rankName: ranking.rankName,
      winRate: ranking.winRate,
      canRefreshOpponents: ranking.canRefreshOpponents,
      canFight: ranking.canFight,
    }));
  }

  // Get user match history
  async getMatchHistory(
    userId: number,
    limit: number = 20,
  ): Promise<PvpMatch[]> {
    return this.pvpMatchRepository.find({
      where: [{ challengerId: userId }, { defenderId: userId }],
      relations: ['challenger', 'defender', 'season'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // Claim daily reward
  async claimDailyReward(
    userId: number,
  ): Promise<{ gold: number; experience: number; items?: any[] }> {
    const ranking = await this.getUserRanking(userId);
    const today = new Date().toDateString();

    if (
      ranking.hasClaimedDailyReward &&
      ranking.lastDailyRewardDate?.toDateString() === today
    ) {
      throw new BadRequestException('Daily reward already claimed today');
    }

    const season = await this.getCurrentSeason();
    const rankRewards = season.rewards?.daily?.[ranking.currentRank];

    if (!rankRewards) {
      throw new NotFoundException('No daily rewards configured for this rank');
    }

    // Build content with items if available
    let content = `Chúc mừng! Bạn đã nhận được phần thưởng hàng ngày cho rank ${ranking.rankName}.\n\nPhần thưởng:\n- ${rankRewards.gold} vàng\n- ${rankRewards.experience} kinh nghiệm`;

    if (rankRewards.items && rankRewards.items.length > 0) {
      content += '\n- Vật phẩm:';
      rankRewards.items.forEach((item) => {
        content += `\n  • ${item.quantity}x Item ID ${item.itemId}`;
      });
    }

    // Send rewards via mailbox instead of direct update
    await this.mailboxService.sendMail({
      userId,
      title: '🏆 Phần thưởng PvP hàng ngày',
      content,
      type: MailType.SYSTEM,
      rewards: {
        gold: rankRewards.gold,
        experience: rankRewards.experience,
        items: rankRewards.items, // Include items
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Update ranking
    ranking.hasClaimedDailyReward = true;
    ranking.lastDailyRewardDate = new Date();
    await this.pvpRankingRepository.save(ranking);

    this.logger.log(
      `User ${userId} claimed daily PvP reward via mailbox: ${rankRewards.gold} gold, ${rankRewards.experience} exp`,
    );

    return rankRewards;
  }

  // Reset daily rewards (run at midnight)
  @Cron('0 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async resetDailyRewards() {
    this.logger.log('Resetting daily PvP rewards...');

    await this.pvpRankingRepository.update(
      { hasClaimedDailyReward: true },
      { hasClaimedDailyReward: false },
    );

    this.logger.log('Daily PvP rewards reset completed');
  }

  // Admin: Create new season
  async createSeason(seasonData: {
    name: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    rewards?: any;
  }): Promise<PvpSeason> {
    // Deactivate current season
    await this.pvpSeasonRepository.update(
      { isActive: true },
      { isActive: false },
    );

    const season = this.pvpSeasonRepository.create({
      ...seasonData,
      isActive: true,
    });

    return this.pvpSeasonRepository.save(season);
  }

  // Admin: Update season
  async updateSeason(
    seasonId: number,
    updateData: Partial<{
      name: string;
      description: string;
      startDate: Date;
      endDate: Date;
      rewards: any;
    }>,
  ): Promise<PvpSeason> {
    await this.pvpSeasonRepository.update(seasonId, updateData);
    const updatedSeason = await this.pvpSeasonRepository.findOne({
      where: { id: seasonId },
    });
    if (!updatedSeason) {
      throw new NotFoundException('Season not found');
    }
    return updatedSeason;
  }

  // Admin: Update season rewards
  async updateSeasonRewards(seasonId: number, rewards: any): Promise<void> {
    await this.pvpSeasonRepository.update(seasonId, { rewards });
    this.logger.log(`Updated rewards for season ${seasonId}`);
  }

  // Admin: Get all seasons
  async getAllSeasons(): Promise<PvpSeason[]> {
    return this.pvpSeasonRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  // Admin: Delete season
  async deleteSeason(seasonId: number): Promise<void> {
    const result = await this.pvpSeasonRepository.delete(seasonId);
    if (result.affected === 0) {
      throw new NotFoundException('Season not found');
    }
    this.logger.log(`Deleted season ${seasonId}`);
  }

  // Admin: Get PvP statistics
  async getPvpStatistics(): Promise<{
    totalPlayers: number;
    totalMatches: number;
    averageRating: number;
    rankDistribution: { [key in HunterRank]: number };
    topPlayers: PvpRanking[];
  }> {
    const season = await this.getCurrentSeason();

    const totalPlayers = await this.pvpRankingRepository.count({
      where: { seasonId: season.id },
    });
    const totalMatches = await this.pvpMatchRepository.count({
      where: { seasonId: season.id },
    });

    const avgResult = await this.pvpRankingRepository
      .createQueryBuilder('ranking')
      .select('AVG(ranking.hunterPoints)', 'average')
      .where('ranking.seasonId = :seasonId', { seasonId: season.id })
      .getRawOne();

    const averageRating = Math.round(parseFloat(avgResult.average) || 1200);

    // Get rank distribution
    const rankDistribution = {} as { [key in HunterRank]: number };
    for (const rank of Object.values(HunterRank)) {
      const count = await this.pvpRankingRepository.count({
        where: { seasonId: season.id, currentRank: rank },
      });
      rankDistribution[rank] = count;
    }

    const topPlayers = await this.getLeaderboard(season.id, 10);

    return {
      totalPlayers,
      totalMatches,
      averageRating,
      rankDistribution,
      topPlayers,
    };
  }

  // Admin: Reset rankings for new season
  async resetRankings(): Promise<void> {
    const season = await this.getCurrentSeason();

    await this.pvpRankingRepository.update(
      { seasonId: season.id },
      {
        hunterPoints: 1200,
        currentRank: HunterRank.APPRENTICE,
        wins: 0,
        losses: 0,
        totalMatches: 0,
        winStreak: 0,
        bestWinStreak: 0,
        highestPoints: 1200,
        hasClaimedDailyReward: false,
        lastDailyRewardDate: null,
      },
    );

    this.logger.log(`Reset all rankings for season ${season.id}`);
  }

  // Admin: Sync all players to PvP system
  async syncAllPlayers(): Promise<{ syncedCount: number; message: string }> {
    const season = await this.getCurrentSeason();

    // Get all users who don't have PvP ranking yet
    const usersWithoutRanking = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin(
        PvpRanking,
        'ranking',
        'ranking.userId = user.id AND ranking.seasonId = :seasonId',
        { seasonId: season.id },
      )
      .where('ranking.id IS NULL')
      .getMany();

    let syncedCount = 0;

    for (const user of usersWithoutRanking) {
      try {
        // Create new ranking for user
        const ranking = this.pvpRankingRepository.create({
          userId: user.id,
          seasonId: season.id,
          hunterPoints: 1200, // Starting ELO
          currentRank: HunterRank.APPRENTICE,
        });
        await this.pvpRankingRepository.save(ranking);
        syncedCount++;
      } catch (error) {
        this.logger.error(`Failed to sync user ${user.id}: ${error.message}`);
      }
    }

    this.logger.log(
      `Synced ${syncedCount} players to PvP system for season ${season.id}`,
    );

    return {
      syncedCount,
      message: `Successfully synced ${syncedCount} players to PvP system`,
    };
  }
}
