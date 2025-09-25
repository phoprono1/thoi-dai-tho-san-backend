import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { DailyLoginService, DailyLoginMetadata } from './daily-login.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

interface AuthenticatedRequest {
  user: { id: number };
}

interface CreateConfigDto {
  year: number;
  month: number;
  metadata: DailyLoginMetadata;
  enabled?: boolean;
}

@Controller('daily-login')
export class DailyLoginController {
  constructor(private readonly dailyLoginService: DailyLoginService) {}

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getUserStatus(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    const canClaim = await this.dailyLoginService.canClaimToday(userId);
    const streak = await this.dailyLoginService.getUserStreak(userId);

    return {
      canClaim,
      currentStreak: streak,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('claim')
  async claimDailyReward(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;

    try {
      const result = await this.dailyLoginService.claimDailyReward(userId);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(message);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getUserHistory(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    const history = await this.dailyLoginService.getUserLoginHistory(userId);
    return { history };
  }

  @UseGuards(JwtAuthGuard)
  @Get('config')
  async getCurrentConfig() {
    const now = new Date();
    const config = await this.dailyLoginService.getCurrentConfig(
      now.getFullYear(),
      now.getMonth() + 1,
    );
    return { config };
  }

  // Admin endpoints
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/configs')
  async getAllConfigs() {
    const configs = await this.dailyLoginService.getAllConfigs();
    return { configs };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/config')
  async createOrUpdateConfig(@Body() body: CreateConfigDto) {
    const { year, month, metadata, enabled = true } = body;
    const config = await this.dailyLoginService.createOrUpdateConfig(
      year,
      month,
      metadata,
      enabled,
    );
    return { config };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/config/:year/:month')
  async getConfig(@Param('year') year: string, @Param('month') month: string) {
    const config = await this.dailyLoginService.getCurrentConfig(
      parseInt(year),
      parseInt(month),
    );
    return { config };
  }
}
