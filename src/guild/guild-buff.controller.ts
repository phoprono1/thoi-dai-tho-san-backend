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
import { GuildBuffService, UpdateGuildBuffDto } from './guild-buff.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GuildBuff } from './guild-buff.entity';

@Controller('guild-buffs')
@UseGuards(JwtAuthGuard)
export class GuildBuffController {
  constructor(private readonly guildBuffService: GuildBuffService) {}

  // Get buffs for a specific guild
  @Get('guild/:guildId')
  async getGuildBuffs(@Param('guildId') guildId: string): Promise<GuildBuff[]> {
    return this.guildBuffService.getGuildBuffs(parseInt(guildId));
  }

  // Get active buff for a guild's current level
  @Get('guild/:guildId/active')
  async getActiveGuildBuff(@Param('guildId') guildId: string): Promise<GuildBuff | null> {
    return this.guildBuffService.getActiveGuildBuff(parseInt(guildId));
  }

  // Get current user's guild buffs
  @Get('my-buffs')
  async getMyGuildBuffs(@Request() req: any): Promise<GuildBuff['statBuffs'] | null> {
    return this.guildBuffService.getUserGuildBuffs(req.user.id);
  }

  // Update a specific guild buff (Admin only)
  @Put('guild/:guildId/level/:level')
  async updateGuildBuff(
    @Param('guildId') guildId: string,
    @Param('level') level: string,
    @Body() updateData: UpdateGuildBuffDto,
  ): Promise<GuildBuff> {
    return this.guildBuffService.updateGuildBuff(
      parseInt(guildId),
      parseInt(level),
      updateData,
    );
  }

  // Initialize default buffs for a guild
  @Post('guild/:guildId/initialize')
  async initializeGuildBuffs(@Param('guildId') guildId: string): Promise<GuildBuff[]> {
    return this.guildBuffService.initializeGuildBuffs(parseInt(guildId));
  }

  // Get all guild buffs (Admin only)
  @Get('admin/all')
  async getAllGuildBuffs(): Promise<GuildBuff[]> {
    return this.guildBuffService.getAllGuildBuffs();
  }

  // Reset guild buffs to default (Admin only)
  @Post('guild/:guildId/reset')
  async resetGuildBuffs(@Param('guildId') guildId: string): Promise<GuildBuff[]> {
    return this.guildBuffService.resetGuildBuffsToDefault(parseInt(guildId));
  }

  // Bulk update guild buffs (Admin only)
  @Put('guild/:guildId/bulk')
  async bulkUpdateGuildBuffs(
    @Param('guildId') guildId: string,
    @Body() updates: Array<{ guildLevel: number } & UpdateGuildBuffDto>,
  ): Promise<GuildBuff[]> {
    return this.guildBuffService.bulkUpdateGuildBuffs(parseInt(guildId), updates);
  }

  // Initialize buffs for all existing guilds (Admin only)
  @Post('admin/initialize-all')
  async initializeAllGuildBuffs(): Promise<{ message: string; initialized: number }> {
    const result = await this.guildBuffService.initializeAllExistingGuilds();
    return {
      message: 'Guild buffs initialized successfully',
      initialized: result
    };
  }

  // Debug endpoint to check guild buffs status
  @Get('debug/status')
  async debugGuildBuffsStatus(): Promise<any> {
    const allGuilds = await this.guildBuffService['guildRepository'].find();
    const allBuffs = await this.guildBuffService.getAllGuildBuffs();
    
    const status = allGuilds.map(guild => ({
      guildId: guild.id,
      guildName: guild.name,
      guildLevel: guild.level,
      hasBuffs: allBuffs.filter(buff => buff.guildId === guild.id).length > 0,
      buffCount: allBuffs.filter(buff => buff.guildId === guild.id).length
    }));

    return {
      totalGuilds: allGuilds.length,
      totalBuffs: allBuffs.length,
      guilds: status
    };
  }
}
