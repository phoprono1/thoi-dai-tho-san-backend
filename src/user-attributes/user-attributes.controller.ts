/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserStatsService } from '../user-stats/user-stats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('user-attributes')
@UseGuards(JwtAuthGuard)
export class UserAttributesController {
  constructor(private readonly userStatsService: UserStatsService) {}

  @Get()
  async getUserAttributes(@Request() req) {
    const userId = req.user.id;
    const userStats = await this.userStatsService.findByUserId(userId);

    if (!userStats) {
      return { error: 'User stats not found' };
    }

    return {
      unspentAttributePoints: userStats.unspentAttributePoints,
      allocatedPoints: {
        strength: userStats.strengthPoints,
        intelligence: userStats.intelligencePoints,
        dexterity: userStats.dexterityPoints,
        vitality: userStats.vitalityPoints,
        luck: userStats.luckPoints,
      },
      baseAttributes: {
        strength: userStats.strength,
        intelligence: userStats.intelligence,
        dexterity: userStats.dexterity,
        vitality: userStats.vitality,
        luck: userStats.luck,
      },
      totalAttributes:
        await this.userStatsService.getTotalStatsWithAllBonuses(userId),
    };
  }

  @Post('allocate')
  async allocateAttributePoint(
    @Request() req,
    @Body() body: { attribute: 'STR' | 'INT' | 'DEX' | 'VIT' | 'LUK' },
  ) {
    const userId = req.user.id;
    const { attribute } = body;

    if (!['STR', 'INT', 'DEX', 'VIT', 'LUK'].includes(attribute)) {
      return { success: false, message: 'Invalid attribute' };
    }

    const result = await this.userStatsService.allocateAttributePoint(
      userId,
      attribute,
    );

    return result;
  }

    @Post('allocate-multiple')
  async allocateMultipleAttributePoints(
    @Request() req,
    @Body() body: { allocations: Record<'STR' | 'INT' | 'DEX' | 'VIT' | 'LUK', number> },
  ) {
    const userId = req.user.id as number;
    const { allocations } = body;

    if (!allocations || typeof allocations !== 'object') {
      return { success: false, message: 'Invalid allocations format' };
    }

    const result = await this.userStatsService.allocateMultipleAttributePoints(
      userId,
      allocations,
    );

    return result;
  }

  @Post('reset')
  async resetAttributePoints(@Request() req) {
    const userId = req.user.id;
    const result = await this.userStatsService.resetAttributePoints(userId);
    return result;
  }
}
