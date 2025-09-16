import { Controller, Get, Param, Query } from '@nestjs/common';
import { UserPowerService } from './user-power.service';

@Controller('user-power/leaderboard')
export class UserPowerLeaderboardController {
  constructor(private readonly ups: UserPowerService) {}

  @Get('top')
  async top(@Query('limit') limit = '100') {
    const n = Number(limit) || 100;
    return this.ups.getTop(n);
  }

  @Get('around/:userId')
  async around(@Param('userId') userId: string, @Query('radius') radius = '5') {
    const uid = Number(userId);
    const r = Number(radius) || 5;
    return this.ups.getAround(uid, r);
  }
}
