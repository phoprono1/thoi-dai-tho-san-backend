import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WorldBossService } from './world-boss.service';
import { BossSchedulerService } from './boss-scheduler.service';
import { BossTemplateService } from './boss-template.service';
import {
  CreateWorldBossDto,
  CreateBossScheduleDto,
  WorldBossResponseDto,
  BossScheduleResponseDto,
  AttackBossDto,
  BossCombatResultDto,
  BossRankingDto,
  CreateBossTemplateDto,
  UpdateBossTemplateDto,
  BossTemplateResponseDto,
  CreateBossFromTemplateDto,
  AssignBossToScheduleDto,
  RemoveBossFromScheduleDto,
} from './world-boss.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('world-boss')
@UseGuards(JwtAuthGuard)
export class WorldBossController {
  constructor(
    private readonly worldBossService: WorldBossService,
    private readonly bossSchedulerService: BossSchedulerService,
    private readonly bossTemplateService: BossTemplateService,
  ) {}

  // Boss Management
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

  // Combat
  @Post('attack')
  async attackBoss(
    @Body() dto: AttackBossDto,
    @Request() req: any,
  ): Promise<BossCombatResultDto> {
    return this.worldBossService.attackBoss(req.user.id, dto);
  }

  // Rankings
  @Get('rankings/:bossId')
  async getBossRankings(
    @Param('bossId') bossId: string,
  ): Promise<BossRankingDto> {
    return this.worldBossService.getBossRankings(parseInt(bossId));
  }

  @Get('rankings')
  async getCurrentBossRankings(): Promise<
    BossRankingDto | { message: string }
  > {
    const currentBoss = await this.worldBossService.getCurrentBoss();
    if (!currentBoss) {
      return { message: 'No active boss found' };
    }
    return this.worldBossService.getBossRankings(currentBoss.id);
  }

  // Boss Scheduling (Admin)
  @Post('schedule')
  async createSchedule(
    @Body() dto: CreateBossScheduleDto,
  ): Promise<BossScheduleResponseDto> {
    const schedule = await this.bossSchedulerService.createSchedule(dto);
    return {
      id: schedule.id,
      name: schedule.name,
      description: schedule.description,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      durationMinutes: schedule.durationMinutes,
      bossTemplate: schedule.bossTemplate,
      isActive: schedule.isActive,
      timezone: schedule.timezone,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    };
  }

  @Get('schedule')
  async getAllSchedules(): Promise<BossScheduleResponseDto[]> {
    const schedules = await this.bossSchedulerService.getAllSchedules();
    return schedules.map((schedule) => ({
      id: schedule.id,
      name: schedule.name,
      description: schedule.description,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      durationMinutes: schedule.durationMinutes,
      bossTemplate: schedule.bossTemplate,
      isActive: schedule.isActive,
      timezone: schedule.timezone,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    }));
  }

  @Get('schedule/active')
  async getActiveSchedules(): Promise<BossScheduleResponseDto[]> {
    const schedules = await this.bossSchedulerService.getActiveSchedules();
    return schedules.map((schedule) => ({
      id: schedule.id,
      name: schedule.name,
      description: schedule.description,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      durationMinutes: schedule.durationMinutes,
      bossTemplate: schedule.bossTemplate,
      isActive: schedule.isActive,
      timezone: schedule.timezone,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    }));
  }

  @Put('schedule/:id')
  async updateSchedule(
    @Param('id') id: string,
    @Body() dto: Partial<CreateBossScheduleDto>,
  ): Promise<BossScheduleResponseDto> {
    const schedule = await this.bossSchedulerService.updateSchedule(
      parseInt(id),
      dto,
    );
    return {
      id: schedule.id,
      name: schedule.name,
      description: schedule.description,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      durationMinutes: schedule.durationMinutes,
      bossTemplate: schedule.bossTemplate,
      isActive: schedule.isActive,
      timezone: schedule.timezone,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    };
  }

  @Delete('schedule/:id')
  async deleteSchedule(@Param('id') id: string): Promise<{ message: string }> {
    await this.bossSchedulerService.deleteSchedule(parseInt(id));
    return { message: 'Schedule deleted successfully' };
  }

  // Boss Template Management
  @Post('template')
  async createTemplate(
    @Body() dto: CreateBossTemplateDto,
  ): Promise<BossTemplateResponseDto> {
    return this.bossTemplateService.createTemplate(dto);
  }

  @Get('template')
  async getAllTemplates(): Promise<BossTemplateResponseDto[]> {
    return this.bossTemplateService.getAllTemplates();
  }

  @Get('template/active')
  async getActiveTemplates(): Promise<BossTemplateResponseDto[]> {
    return this.bossTemplateService.getActiveTemplates();
  }

  @Get('template/:id')
  async getTemplateById(
    @Param('id') id: string,
  ): Promise<BossTemplateResponseDto> {
    return this.bossTemplateService.getTemplateById(parseInt(id));
  }

  @Put('template/:id')
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateBossTemplateDto,
  ): Promise<BossTemplateResponseDto> {
    return this.bossTemplateService.updateTemplate(parseInt(id), dto);
  }

  @Delete('template/:id')
  async deleteTemplate(@Param('id') id: string): Promise<{ message: string }> {
    await this.bossTemplateService.deleteTemplate(parseInt(id));
    return { message: 'Template deleted successfully' };
  }

  @Get('template/category/:category')
  async getTemplatesByCategory(
    @Param('category') category: string,
  ): Promise<BossTemplateResponseDto[]> {
    return this.bossTemplateService.getTemplatesByCategory(category);
  }

  // Enhanced Boss Management
  @Post('from-template')
  async createBossFromTemplate(
    @Body() dto: CreateBossFromTemplateDto,
  ): Promise<WorldBossResponseDto> {
    return this.worldBossService.createBossFromTemplate(dto);
  }

  @Put('assign-schedule')
  async assignBossToSchedule(
    @Body() dto: AssignBossToScheduleDto,
  ): Promise<WorldBossResponseDto> {
    return this.worldBossService.assignBossToSchedule(dto);
  }

  @Put('remove-schedule')
  async removeBossFromSchedule(
    @Body() dto: RemoveBossFromScheduleDto,
  ): Promise<WorldBossResponseDto> {
    return this.worldBossService.removeBossFromSchedule(dto);
  }

  @Put(':id/rewards')
  async updateBossRewards(
    @Param('id') id: string,
    @Body() customRewards: any,
  ): Promise<WorldBossResponseDto> {
    return this.worldBossService.updateBossRewards(parseInt(id), customRewards);
  }

  @Get('with-templates')
  async getBossesWithTemplates(): Promise<any[]> {
    return this.worldBossService.getBossesWithTemplates();
  }

  // Admin endpoint to manually end expired bosses and distribute rewards
  @Post('end-expired')
  async endExpiredBosses(): Promise<{ message: string }> {
    await this.worldBossService.endExpiredBosses();
    return { message: 'Expired bosses have been ended and rewards distributed' };
  }

  // Admin endpoint to manually end a specific boss
  @Post(':id/end')
  async endBoss(@Param('id') id: string): Promise<{ message: string }> {
    const success = await this.worldBossService.manuallyEndBoss(parseInt(id));
    if (success) {
      return { message: 'Boss has been ended and rewards distributed' };
    }
    return { message: 'Boss not found or already ended' };
  }
}
