/* eslint-disable @typescript-eslint/no-unsafe-return */
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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PvpService } from './pvp.service';
import { PvpMatch, PvpMatchType, PvpTeam } from './pvp.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('PVP - Đấu trường')
@ApiBearerAuth()
@Controller('pvp')
@UseGuards(JwtAuthGuard)
export class PvpController {
  constructor(private readonly pvpService: PvpService) {}

  @Post('create')
  @ApiOperation({ summary: 'Tạo trận đấu PVP mới' })
  @ApiResponse({
    status: 201,
    description: 'Trận đấu đã được tạo thành công',
    type: PvpMatch,
  })
  async createMatch(
    @Request() req,
    @Body('matchType') matchType: PvpMatchType,
  ): Promise<PvpMatch> {
    return await this.pvpService.createMatch(req.user.id, matchType);
  }

  @Post(':matchId/join')
  @ApiOperation({ summary: 'Tham gia trận đấu PVP' })
  @ApiResponse({
    status: 200,
    description: 'Đã tham gia trận đấu thành công',
  })
  async joinMatch(
    @Request() req,
    @Param('matchId') matchId: number,
    @Body('team') team: PvpTeam,
  ) {
    return await this.pvpService.joinMatch(matchId, req.user.id, team);
  }

  @Post(':matchId/leave')
  @ApiOperation({ summary: 'Rời khỏi trận đấu PVP' })
  @ApiResponse({
    status: 200,
    description: 'Đã rời khỏi trận đấu thành công',
  })
  async leaveMatch(@Request() req, @Param('matchId') matchId: number) {
    await this.pvpService.leaveMatch(matchId, req.user.id);
    return { message: 'Đã rời khỏi trận đấu thành công' };
  }

  @Post(':matchId/start')
  @ApiOperation({ summary: 'Bắt đầu trận đấu PVP' })
  @ApiResponse({
    status: 200,
    description: 'Trận đấu đã bắt đầu',
    type: PvpMatch,
  })
  async startMatch(
    @Request() req,
    @Param('matchId') matchId: number,
  ): Promise<PvpMatch> {
    return await this.pvpService.startMatch(matchId, req.user.id);
  }

  @Post(':matchId/end')
  @ApiOperation({ summary: 'Kết thúc trận đấu PVP' })
  @ApiResponse({
    status: 200,
    description: 'Trận đấu đã kết thúc',
    type: PvpMatch,
  })
  async endMatch(
    @Param('matchId') matchId: number,
    @Body('winnerTeam') winnerTeam: PvpTeam,
  ): Promise<PvpMatch> {
    return await this.pvpService.endMatch(matchId, winnerTeam);
  }

  @Post(':matchId/cancel')
  @ApiOperation({ summary: 'Hủy trận đấu PVP' })
  @ApiResponse({
    status: 200,
    description: 'Trận đấu đã được hủy',
  })
  async cancelMatch(@Request() req, @Param('matchId') matchId: number) {
    await this.pvpService.cancelMatch(matchId, req.user.id);
    return { message: 'Trận đấu đã được hủy' };
  }

  @Put(':matchId/ready')
  @ApiOperation({ summary: 'Cập nhật trạng thái sẵn sàng' })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái đã được cập nhật',
  })
  async setPlayerReady(
    @Request() req,
    @Param('matchId') matchId: number,
    @Body('isReady') isReady: boolean,
  ) {
    return await this.pvpService.setPlayerReady(matchId, req.user.id, isReady);
  }

  @Post(':matchId/calculate-result')
  @ApiOperation({ summary: 'Tính toán kết quả trận đấu' })
  @ApiResponse({
    status: 200,
    description: 'Kết quả trận đấu đã được tính toán',
  })
  async calculateMatchResult(@Param('matchId') matchId: number) {
    return await this.pvpService.calculateMatchResult(matchId);
  }

  @Get('waiting')
  @ApiOperation({ summary: 'Lấy danh sách trận đấu đang chờ' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách trận đấu đang chờ',
    type: [PvpMatch],
  })
  async getWaitingMatches(): Promise<PvpMatch[]> {
    return await this.pvpService.getWaitingMatches();
  }

  @Get(':matchId')
  @ApiOperation({ summary: 'Lấy chi tiết trận đấu' })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết trận đấu',
    type: PvpMatch,
  })
  async getMatch(@Param('matchId') matchId: number): Promise<PvpMatch> {
    return await this.pvpService.getMatch(matchId);
  }

  @Get('user/matches')
  @ApiOperation({ summary: 'Lấy lịch sử trận đấu của người chơi' })
  @ApiResponse({
    status: 200,
    description: 'Lịch sử trận đấu',
    type: [PvpMatch],
  })
  async getUserMatches(@Request() req): Promise<PvpMatch[]> {
    return await this.pvpService.getUserMatches(req.user.id);
  }
}
