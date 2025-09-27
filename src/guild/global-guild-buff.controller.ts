import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  GlobalGuildBuffService,
  UpdateGlobalGuildBuffDto,
} from './global-guild-buff.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GlobalGuildBuff } from './global-guild-buff.entity';

@Controller('global-guild-buffs')
@UseGuards(JwtAuthGuard)
export class GlobalGuildBuffController {
  constructor(
    private readonly globalGuildBuffService: GlobalGuildBuffService,
  ) {}

  // Get all global guild buffs (Admin only)
  @Get('admin/all')
  async getAllGlobalBuffs(): Promise<GlobalGuildBuff[]> {
    return this.globalGuildBuffService.getAllGlobalBuffs();
  }

  // Get buff for specific level
  @Get('level/:level')
  async getBuffForLevel(
    @Param('level') level: string,
  ): Promise<GlobalGuildBuff | null> {
    return this.globalGuildBuffService.getBuffForLevel(parseInt(level));
  }

  // Get current user's guild buffs
  @Get('my-buffs')
  async getMyGuildBuffs(
    @Request() req: any,
  ): Promise<GlobalGuildBuff['statBuffs'] | null> {
    return this.globalGuildBuffService.getUserGuildBuffs(req.user.id);
  }

  // Update a specific level's buff (Admin only)
  @Put('admin/level/:level')
  async updateGlobalBuff(
    @Param('level') level: string,
    @Body() updateData: UpdateGlobalGuildBuffDto,
  ): Promise<GlobalGuildBuff> {
    return this.globalGuildBuffService.updateGlobalBuff(
      parseInt(level),
      updateData,
    );
  }

  // Initialize default global buffs (Admin only)
  @Post('admin/initialize')
  async initializeGlobalBuffs(): Promise<{
    message: string;
    buffs: GlobalGuildBuff[];
  }> {
    const buffs = await this.globalGuildBuffService.initializeGlobalBuffs();
    return {
      message: 'Global guild buffs initialized successfully',
      buffs,
    };
  }

  // Reset all buffs to defaults (Admin only)
  @Post('admin/reset')
  async resetToDefaults(): Promise<{
    message: string;
    buffs: GlobalGuildBuff[];
  }> {
    const buffs = await this.globalGuildBuffService.resetToDefaults();
    return {
      message: 'Global guild buffs reset to defaults',
      buffs,
    };
  }

  // Bulk update multiple levels (Admin only)
  @Put('admin/bulk')
  async bulkUpdateGlobalBuffs(
    @Body() updates: Array<{ guildLevel: number } & UpdateGlobalGuildBuffDto>,
  ): Promise<GlobalGuildBuff[]> {
    return this.globalGuildBuffService.bulkUpdateGlobalBuffs(updates);
  }

  // Get buffs summary (Admin only)
  @Get('admin/summary')
  async getBuffsSummary(): Promise<any> {
    return this.globalGuildBuffService.getBuffsSummary();
  }
}
