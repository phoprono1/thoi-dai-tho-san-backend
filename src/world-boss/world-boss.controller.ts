import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WorldBossService } from './world-boss.service';
import {
  CreateWorldBossDto,
  WorldBossResponseDto,
  AttackBossDto,
  BossCombatResultDto,
} from './world-boss.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('world-boss')
@UseGuards(JwtAuthGuard)
export class WorldBossController {
  constructor(private readonly worldBossService: WorldBossService) {}

  @Post()
  async createBoss(
    @Body() dto: CreateWorldBossDto,
  ): Promise<WorldBossResponseDto> {
    return this.worldBossService.createBoss(dto);
  }

  @Get('current')
  async getCurrentBoss(): Promise<WorldBossResponseDto | null> {
    return this.worldBossService.getCurrentBoss();
  }

  @Post('attack')
  async attackBoss(
    @Body() dto: AttackBossDto,
    @Request() req: any,
  ): Promise<BossCombatResultDto> {
    return this.worldBossService.attackBoss(req.user.id, dto);
  }

  @Get('rankings/:bossId')
  async getBossRankings(@Param('bossId') bossId: string) {
    return this.worldBossService.getBossRankings(parseInt(bossId));
  }

  @Get('rankings')
  async getCurrentBossRankings() {
    const currentBoss = await this.worldBossService.getCurrentBoss();
    if (!currentBoss) {
      return { message: 'No active boss found' };
    }
    return this.worldBossService.getBossRankings(currentBoss.id);
  }
}
