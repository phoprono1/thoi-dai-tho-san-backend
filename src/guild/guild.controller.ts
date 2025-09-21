/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GuildService } from './guild.service';
import { Guild, GuildMember, GuildEvent } from './guild.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateGuildDto } from './dto/create-guild.dto';
import { ContributeDto } from './dto/contribute.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateGuildWarDto } from './dto/create-guild-war.dto';

@ApiTags('Công hội - Guild')
@ApiBearerAuth()
@Controller('guild')
@UseGuards(JwtAuthGuard)
export class GuildController {
  constructor(private readonly guildService: GuildService) {}

  @Post('create')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Tạo công hội mới' })
  @ApiResponse({
    status: 201,
    description: 'Công hội đã được tạo thành công',
    type: Guild,
  })
  async createGuild(
    @Request() req,
    @Body() dto: CreateGuildDto,
  ): Promise<Guild> {
    try {
      return await this.guildService.createGuild(
        req.user.id,
        dto.name,
        dto.description,
      );
    } catch (err) {
      // Log diagnostic info to help debug production 500s
      try {
        const uid = req?.user?.id;
        // eslint-disable-next-line no-console
        console.error('[GuildController] createGuild failed', {
          userId: uid,
          dto,
          err,
        });
      } catch (logErr) {
        // ignore logging errors
      }
      throw err;
    }
  }

  @Post(':guildId/join')
  @ApiOperation({ summary: 'Xin vào công hội' })
  @ApiResponse({
    status: 200,
    description: 'Đã gửi yêu cầu tham gia công hội',
  })
  async requestJoinGuild(@Request() req, @Param('guildId') guildId: number) {
    return await this.guildService.requestJoinGuild(req.user.id, guildId);
  }

  @Post(':guildId/approve/:userId')
  @ApiOperation({ summary: 'Duyệt thành viên vào công hội' })
  @ApiResponse({
    status: 200,
    description: 'Đã duyệt thành viên vào công hội',
  })
  async approveMember(
    @Request() req,
    @Param('guildId') guildId: number,
    @Param('userId') userId: number,
  ): Promise<GuildMember> {
    return await this.guildService.approveMember(guildId, userId, req.user.id);
  }

  @Post(':guildId/contribute')
  @ApiOperation({ summary: 'Cống hiến vàng cho công hội' })
  @ApiResponse({
    status: 200,
    description: 'Đã cống hiến vàng thành công',
  })
  async contributeGold(
    @Request() req,
    @Param('guildId') guildId: number,
    @Body() dto: ContributeDto,
  ): Promise<GuildMember> {
    return await this.guildService.contributeGold(
      req.user.id,
      guildId,
      dto.amount,
    );
  }

  @Post(':guildId/upgrade')
  @ApiOperation({ summary: 'Nâng cấp công hội' })
  @ApiResponse({
    status: 200,
    description: 'Công hội đã được nâng cấp',
    type: Guild,
  })
  async upgradeGuild(
    @Request() req,
    @Param('guildId') guildId: number,
  ): Promise<Guild> {
    return await this.guildService.upgradeGuild(guildId, req.user.id);
  }

  @Put(':guildId/assign-role/:userId')
  @ApiOperation({ summary: 'Bổ nhiệm chức vụ cho thành viên' })
  @ApiResponse({
    status: 200,
    description: 'Đã bổ nhiệm chức vụ thành công',
  })
  async assignRole(
    @Request() req,
    @Param('guildId') guildId: number,
    @Param('userId') userId: number,
    @Body() dto: AssignRoleDto,
  ): Promise<GuildMember> {
    return await this.guildService.assignRole(
      guildId,
      userId,
      dto.role,
      req.user.id,
    );
  }

  @Post(':guildId/leave')
  @ApiOperation({ summary: 'Rời công hội hiện tại' })
  @ApiResponse({ status: 200, description: 'Đã rời công hội' })
  async leaveGuild(@Request() req, @Param('guildId') guildId: number) {
    return await this.guildService.leaveGuild(req.user.id, guildId);
  }

  @Post(':guildId/invite')
  @ApiOperation({
    summary: 'Mời tham gia công hội (phát lời mời ra chat thế giới)',
  })
  @ApiResponse({ status: 200, description: 'Lời mời đã được phát' })
  async inviteToGuild(@Request() req, @Param('guildId') guildId: number) {
    return await this.guildService.inviteGuild(guildId, req.user.id);
  }

  @Post(':guildId/reject/:userId')
  @ApiOperation({ summary: 'Từ chối yêu cầu tham gia công hội' })
  @ApiResponse({ status: 200, description: 'Đã từ chối yêu cầu' })
  async rejectMember(
    @Request() req,
    @Param('guildId') guildId: number,
    @Param('userId') userId: number,
  ) {
    return await this.guildService.rejectMember(guildId, userId, req.user.id);
  }

  @Post(':guildId/kick/:userId')
  @ApiOperation({ summary: 'Đuổi thành viên khỏi công hội' })
  @ApiResponse({ status: 200, description: 'Đã đuổi thành viên' })
  async kickMember(
    @Request() req,
    @Param('guildId') guildId: number,
    @Param('userId') userId: number,
  ) {
    return await this.guildService.kickMember(guildId, userId, req.user.id);
  }

  @Post(':guildId/create-guild-war')
  @ApiOperation({ summary: 'Tạo sự kiện công hội chiến' })
  @ApiResponse({
    status: 201,
    description: 'Sự kiện công hội chiến đã được tạo',
    type: GuildEvent,
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createGuildWar(
    @Param('guildId') guildId: number,
    @Body() dto: CreateGuildWarDto,
  ): Promise<GuildEvent> {
    return await this.guildService.createGuildWar(
      guildId,
      dto.opponentGuildId,
      dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách công hội' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách công hội',
    type: [Guild],
  })
  async getGuilds(): Promise<Guild[]> {
    return await this.guildService.getGuilds();
  }

  @Get(':guildId')
  @ApiOperation({ summary: 'Lấy chi tiết công hội' })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết công hội',
    type: Guild,
  })
  async getGuild(@Param('guildId') guildId: number): Promise<Guild> {
    return await this.guildService.getGuild(guildId);
  }

  @Get('user/current')
  @ApiOperation({ summary: 'Lấy công hội của người chơi hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Công hội của người chơi',
    type: Guild,
  })
  async getUserGuild(@Request() req): Promise<Guild | null> {
    return await this.guildService.getUserGuild(req.user.id);
  }

  @Get(':guildId/members')
  @ApiOperation({ summary: 'Lấy danh sách thành viên công hội' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách thành viên công hội',
    type: [GuildMember],
  })
  async getGuildMembers(
    @Param('guildId') guildId: number,
  ): Promise<GuildMember[]> {
    return await this.guildService.getGuildMembers(guildId);
  }

  @Get(':guildId/requests')
  @ApiOperation({
    summary: 'Lấy danh sách yêu cầu tham gia công hội (chưa duyệt)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách yêu cầu tham gia',
    type: [GuildMember],
  })
  async getGuildRequests(
    @Param('guildId') guildId: number,
  ): Promise<GuildMember[]> {
    return await this.guildService.getGuildRequests(guildId);
  }

  @Get(':guildId/events')
  @ApiOperation({ summary: 'Lấy sự kiện của công hội' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách sự kiện công hội',
    type: [GuildEvent],
  })
  async getGuildEvents(
    @Param('guildId') guildId: number,
  ): Promise<GuildEvent[]> {
    return await this.guildService.getGuildEvents(guildId);
  }
}
