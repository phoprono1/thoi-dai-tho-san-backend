import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PvpRankingService } from './pvp-ranking.service';
import { MailboxService } from '../mailbox/mailbox.service';
import { MailType } from '../mailbox/mailbox.entity';
import { PvpSeason, HunterRank } from './entities';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

interface CreateSeasonDto {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  rewards?: {
    daily: {
      [key in HunterRank]: {
        gold: number;
        experience: number;
        items?: Array<{ itemId: number; quantity: number }>;
      };
    };
    seasonal: {
      top1: { gold: number; experience: number; items?: Array<{ itemId: number; quantity: number }> };
      top2to3: { gold: number; experience: number; items?: Array<{ itemId: number; quantity: number }> };
      top4to10: { gold: number; experience: number; items?: Array<{ itemId: number; quantity: number }> };
    };
  };
}

@ApiTags('PVP Admin - Quản lý đấu trường')
@ApiBearerAuth()
@Controller('admin/pvp')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PvpAdminController {
  constructor(
    private readonly pvpRankingService: PvpRankingService,
    private readonly mailboxService: MailboxService,
  ) {}

  @Get('seasons')
  @ApiOperation({ summary: 'Lấy danh sách tất cả mùa giải' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách mùa giải',
    type: [PvpSeason],
  })
  async getAllSeasons(): Promise<PvpSeason[]> {
    return this.pvpRankingService.getAllSeasons();
  }

  @Post('seasons')
  @ApiOperation({ summary: 'Tạo mùa giải mới' })
  @ApiResponse({
    status: 201,
    description: 'Mùa giải đã được tạo',
    type: PvpSeason,
  })
  async createSeason(@Body() createSeasonDto: CreateSeasonDto): Promise<PvpSeason> {
    return this.pvpRankingService.createSeason({
      name: createSeasonDto.name,
      description: createSeasonDto.description,
      startDate: new Date(createSeasonDto.startDate),
      endDate: new Date(createSeasonDto.endDate),
      rewards: createSeasonDto.rewards,
    });
  }

  @Put('seasons/:id')
  @ApiOperation({ summary: 'Cập nhật mùa giải' })
  @ApiResponse({
    status: 200,
    description: 'Mùa giải đã được cập nhật',
    type: PvpSeason,
  })
  async updateSeason(
    @Param('id') id: string,
    @Body() updateSeasonDto: Partial<CreateSeasonDto>,
  ): Promise<PvpSeason> {
    const updateData = {
      ...updateSeasonDto,
      startDate: updateSeasonDto.startDate ? new Date(updateSeasonDto.startDate) : undefined,
      endDate: updateSeasonDto.endDate ? new Date(updateSeasonDto.endDate) : undefined,
    };
    return this.pvpRankingService.updateSeason(parseInt(id), updateData);
  }

  @Put('seasons/:id/rewards')
  @ApiOperation({ summary: 'Cập nhật rewards cho mùa giải' })
  @ApiResponse({
    status: 200,
    description: 'Rewards đã được cập nhật',
  })
  async updateSeasonRewards(
    @Param('id') id: string,
    @Body() rewards: CreateSeasonDto['rewards'],
  ): Promise<{ message: string }> {
    await this.pvpRankingService.updateSeasonRewards(parseInt(id), rewards);
    return { message: 'Season rewards updated successfully' };
  }

  @Delete('seasons/:id')
  @ApiOperation({ summary: 'Xóa mùa giải' })
  @ApiResponse({
    status: 200,
    description: 'Mùa giải đã được xóa',
  })
  async deleteSeason(@Param('id') id: string): Promise<{ message: string }> {
    await this.pvpRankingService.deleteSeason(parseInt(id));
    return { message: 'Season deleted successfully' };
  }

  @Post('reset-rankings')
  @ApiOperation({ summary: 'Reset tất cả rankings về mặc định' })
  @ApiResponse({
    status: 200,
    description: 'Rankings đã được reset',
  })
  async resetRankings(): Promise<{ message: string }> {
    await this.pvpRankingService.resetRankings();
    return { message: 'All rankings have been reset successfully' };
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Lấy thống kê tổng quan PvP' })
  @ApiResponse({
    status: 200,
    description: 'Thống kê PvP',
  })
  async getPvpStatistics(): Promise<{
    totalPlayers: number;
    totalMatches: number;
    averageRating: number;
    rankDistribution: { [key in HunterRank]: number };
    topPlayers: any[];
  }> {
    return this.pvpRankingService.getPvpStatistics();
  }

  @Post('distribute-seasonal-rewards')
  @ApiOperation({ summary: 'Phát thưởng cuối mùa cho top 10' })
  @ApiResponse({
    status: 200,
    description: 'Thưởng cuối mùa đã được phát',
  })
  async distributeSeasonalRewards(): Promise<{ message: string; rewards: any[] }> {
    // This would need to be implemented in the service
    const topPlayers = await this.pvpRankingService.getLeaderboard(undefined, 10);
    const season = await this.pvpRankingService.getCurrentSeason();
    
    const rewards = [];
    
    for (let i = 0; i < topPlayers.length; i++) {
      const player = topPlayers[i];
      let rewardTier: 'top1' | 'top2to3' | 'top4to10';
      
      if (i === 0) {
        rewardTier = 'top1';
      } else if (i <= 2) {
        rewardTier = 'top2to3';
      } else {
        rewardTier = 'top4to10';
      }
      
      const reward = season.rewards?.seasonal?.[rewardTier];
      if (reward) {
        // Send seasonal rewards via mailbox
        const rankText = i === 0 ? '🥇 Hạng 1' : 
                        i <= 2 ? `🥈 Hạng ${i + 1}` : 
                        `🥉 Hạng ${i + 1}`;
        
        await this.mailboxService.sendMail({
          userId: player.userId,
          title: `🏆 Phần thưởng cuối mùa PvP - ${rankText}`,
          content: `Chúc mừng! Bạn đã đạt ${rankText} trong mùa giải "${season.name}"!\n\nPhần thưởng:\n- ${reward.gold} vàng\n- ${reward.experience} kinh nghiệm${reward.items ? `\n- ${reward.items.length} vật phẩm đặc biệt` : ''}`,
          type: MailType.SYSTEM,
          rewards: {
            gold: reward.gold,
            experience: reward.experience,
            items: reward.items,
          },
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });

        rewards.push({
          userId: player.userId,
          username: player.user.username,
          rank: i + 1,
          reward,
        });
      }
    }
    
    return {
      message: `Seasonal rewards distributed to ${rewards.length} players`,
      rewards,
    };
  }

  @Get('default-season-config')
  @ApiOperation({ summary: 'Lấy config mặc định cho mùa giải mới' })
  @ApiResponse({
    status: 200,
    description: 'Config mặc định',
  })
  async getDefaultSeasonConfig(): Promise<CreateSeasonDto> {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return {
      name: `Mùa ${now.getFullYear()}-${now.getMonth() + 1}-${Math.ceil(now.getDate() / 7)}`,
      description: 'Mùa giải PvP hàng tuần',
      startDate: now.toISOString(),
      endDate: nextWeek.toISOString(),
      rewards: {
        daily: {
          [HunterRank.APPRENTICE]: { gold: 100, experience: 50 },
          [HunterRank.AMATEUR]: { gold: 200, experience: 100 },
          [HunterRank.PROFESSIONAL]: { gold: 300, experience: 150 },
          [HunterRank.ELITE]: { gold: 500, experience: 250 },
          [HunterRank.EPIC]: { gold: 750, experience: 375 },
          [HunterRank.LEGENDARY]: { gold: 1000, experience: 500 },
          [HunterRank.MYTHICAL]: { gold: 1500, experience: 750 },
          [HunterRank.DIVINE]: { gold: 2000, experience: 1000 },
        },
        seasonal: {
          top1: { gold: 50000, experience: 25000 },
          top2to3: { gold: 25000, experience: 12500 },
          top4to10: { gold: 10000, experience: 5000 },
        },
      },
    };
  }

  @Post('sync-players')
  @ApiOperation({ summary: 'Đồng bộ tất cả người chơi vào hệ thống PvP' })
  @ApiResponse({
    status: 200,
    description: 'Đồng bộ thành công',
    schema: {
      type: 'object',
      properties: {
        syncedCount: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async syncPlayers(): Promise<{ syncedCount: number; message: string }> {
    return this.pvpRankingService.syncAllPlayers();
  }
}
