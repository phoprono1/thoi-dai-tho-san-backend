import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PvpRankingService } from './pvp-ranking.service';
import { PvpRanking, PvpSeason, PvpMatch } from './entities';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('PVP Ranking - Đấu trường Thợ Săn')
@ApiBearerAuth()
@Controller('pvp-ranking')
@UseGuards(JwtAuthGuard)
export class PvpRankingController {
  constructor(private readonly pvpRankingService: PvpRankingService) {}

  @Get('my-ranking')
  @ApiOperation({ summary: 'Lấy thông tin ranking của người chơi hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin ranking thành công',
    type: PvpRanking,
  })
  async getMyRanking(@Request() req): Promise<PvpRanking> {
    return this.pvpRankingService.getUserRanking(req.user.id);
  }

  @Get('opponents')
  @ApiOperation({ summary: 'Lấy danh sách đối thủ tiềm năng (5 người)' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách đối thủ',
    type: [PvpRanking],
  })
  async getPotentialOpponents(@Request() req): Promise<PvpRanking[]> {
    return this.pvpRankingService.getPotentialOpponents(req.user.id);
  }

  @Post('challenge/:defenderId')
  @ApiOperation({ summary: 'Khiêu chiến một người chơi khác' })
  @ApiResponse({
    status: 201,
    description: 'Trận đấu đã được tạo và hoàn thành',
    type: PvpMatch,
  })
  async challengePlayer(
    @Request() req,
    @Param('defenderId') defenderId: string,
  ): Promise<PvpMatch> {
    return this.pvpRankingService.challengePlayer(
      req.user.id,
      parseInt(defenderId),
    );
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Lấy bảng xếp hạng PvP' })
  @ApiQuery({ name: 'seasonId', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Bảng xếp hạng',
    type: [PvpRanking],
  })
  async getLeaderboard(
    @Query('seasonId') seasonId?: string,
    @Query('limit') limit?: string,
  ): Promise<PvpRanking[]> {
    return this.pvpRankingService.getLeaderboard(
      seasonId ? parseInt(seasonId) : undefined,
      limit ? parseInt(limit) : 100,
    );
  }

  @Get('match-history')
  @ApiOperation({ summary: 'Lấy lịch sử trận đấu của người chơi' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Lịch sử trận đấu',
    type: [PvpMatch],
  })
  async getMatchHistory(
    @Request() req,
    @Query('limit') limit?: string,
  ): Promise<PvpMatch[]> {
    return this.pvpRankingService.getMatchHistory(
      req.user.id,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('current-season')
  @ApiOperation({ summary: 'Lấy thông tin mùa giải hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin mùa giải',
    type: PvpSeason,
  })
  async getCurrentSeason(): Promise<PvpSeason> {
    return this.pvpRankingService.getCurrentSeason();
  }

  @Post('claim-daily-reward')
  @ApiOperation({ summary: 'Nhận phần thưởng hàng ngày theo rank' })
  @ApiResponse({
    status: 200,
    description: 'Phần thưởng đã được nhận',
  })
  async claimDailyReward(@Request() req): Promise<{
    gold: number;
    experience: number;
    items?: any[];
    message: string;
  }> {
    const reward = await this.pvpRankingService.claimDailyReward(req.user.id);
    return {
      ...reward,
      message: 'Daily reward claimed successfully!',
    };
  }

  @Get('match/:matchId')
  @ApiOperation({ summary: 'Lấy chi tiết trận đấu' })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết trận đấu',
    type: PvpMatch,
  })
  async getMatchDetails(@Param('matchId') matchId: string): Promise<PvpMatch> {
    // This would need to be implemented in the service
    // For now, we can get it from match history
    const matches = await this.pvpRankingService.getMatchHistory(0, 1000);
    const match = matches.find((m) => m.id === parseInt(matchId));
    if (!match) {
      throw new Error('Match not found');
    }
    return match;
  }

  @Get('stats/summary')
  @ApiOperation({ summary: 'Lấy thống kê tổng quan PvP của người chơi' })
  @ApiResponse({
    status: 200,
    description: 'Thống kê PvP',
  })
  async getPvpStats(@Request() req): Promise<{
    ranking: PvpRanking;
    recentMatches: PvpMatch[];
    canFight: boolean;
    canRefreshOpponents: boolean;
    nextRewardReset: string;
  }> {
    const ranking = await this.pvpRankingService.getUserRanking(req.user.id);
    const recentMatches = await this.pvpRankingService.getMatchHistory(
      req.user.id,
      5,
    );

    // Calculate next reward reset (midnight Vietnam time)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return {
      ranking,
      recentMatches,
      canFight: ranking.canFight,
      canRefreshOpponents: ranking.canRefreshOpponents,
      nextRewardReset: tomorrow.toISOString(),
    };
  }
}
