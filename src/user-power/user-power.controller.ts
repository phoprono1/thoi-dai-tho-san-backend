import { Controller, Post, Get, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { UserPowerService } from './user-power.service';

@ApiTags('user-power')
@Controller('user-power')
export class UserPowerController {
  private readonly logger = new Logger(UserPowerController.name);
  constructor(private readonly userPowerService: UserPowerService) {}

  @Post('backfill')
  @ApiOperation({ summary: 'Backfill/compute combat power for all users' })
  async backfillAll(): Promise<{ message: string }> {
    this.logger.log('Starting user_power backfill');
    // runs in-process; this may take time depending on DB size
    await this.userPowerService.backfillAll();
    this.logger.log('Completed user_power backfill');
    return { message: 'backfill started/completed' };
  }

  @Get(':userId')
  @ApiOperation({
    summary: 'Get stored combat power for a user (compute if missing)',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getUserPower(@Param('userId') userId: string) {
    const id = +userId;
    try {
      const power = await this.userPowerService.computeAndSaveForUser(id);
      return { userId: id, combatPower: power };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to compute power for user ${id}: ${msg}`);
      return { userId: id, combatPower: null };
    }
  }
}
