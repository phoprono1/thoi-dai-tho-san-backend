import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { RoomLobbyService } from './room-lobby.service';
import { RoomStatus } from './room-lobby.entity';

@ApiTags('room-lobby')
@Controller('room-lobby')
export class RoomLobbyController {
  constructor(private readonly roomLobbyService: RoomLobbyService) {}

  @Post('create')
  @ApiOperation({ summary: 'Tạo phòng chờ mới' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        hostId: { type: 'number', example: 1 },
        dungeonId: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Đội săn rồng' },
        isPrivate: { type: 'boolean', example: false },
        password: { type: 'string', example: '123456' },
        minPlayers: { type: 'number', example: 1 },
        maxPlayers: { type: 'number', example: 4 },
      },
      required: ['hostId', 'dungeonId', 'name'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Phòng đã được tạo thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ',
  })
  async createRoom(
    @Body()
    body: {
      hostId: number;
      dungeonId: number;
      name: string;
      isPrivate?: boolean;
      password?: string;
      minPlayers?: number;
      maxPlayers?: number;
    },
  ) {
    return this.roomLobbyService.createRoom(
      body.hostId,
      body.dungeonId,
      body.name,
      body.isPrivate,
      body.password,
      body.minPlayers,
      body.maxPlayers,
    );
  }

  @Post(':roomId/join')
  @ApiOperation({ summary: 'Tham gia phòng chờ' })
  @ApiParam({ name: 'roomId', description: 'ID của phòng' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        playerId: { type: 'number', example: 2 },
        password: { type: 'string', example: '123456' },
      },
      required: ['playerId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Đã tham gia phòng thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Không thể tham gia phòng',
  })
  async joinRoom(
    @Param('roomId') roomId: string,
    @Body() body: { playerId: number; password?: string },
  ) {
    const roomLobby = await this.roomLobbyService.joinRoom(
      +roomId,
      body.playerId,
      body.password,
    );

    return {
      success: true,
      message: 'Đã tham gia phòng thành công',
      roomLobby,
    };
  }

  @Post(':roomId/leave')
  @ApiOperation({ summary: 'Rời phòng chờ' })
  @ApiParam({ name: 'roomId', description: 'ID của phòng' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        playerId: { type: 'number', example: 2 },
      },
      required: ['playerId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Đã rời phòng thành công',
  })
  async leaveRoom(
    @Param('roomId') roomId: string,
    @Body() body: { playerId: number },
  ) {
    return this.roomLobbyService.leaveRoom(+roomId, body.playerId);
  }

  @Post(':roomId/start')
  @ApiOperation({ summary: 'Bắt đầu trận chiến' })
  @ApiParam({ name: 'roomId', description: 'ID của phòng' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        hostId: { type: 'number', example: 1 },
      },
      required: ['hostId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Trận chiến đã bắt đầu',
  })
  @ApiResponse({
    status: 400,
    description: 'Không thể bắt đầu trận chiến',
  })
  async startCombat(
    @Param('roomId') roomId: string,
    @Body() body: { hostId: number },
  ) {
    return this.roomLobbyService.startCombat(+roomId, body.hostId);
  }

  @Post(':roomId/reset')
  @ApiOperation({ summary: 'Reset phòng về trạng thái chờ sau combat' })
  @ApiParam({ name: 'roomId', description: 'ID của phòng' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        hostId: { type: 'number', example: 1 },
      },
      required: ['hostId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Phòng đã được reset về trạng thái chờ',
  })
  async resetRoom(
    @Param('roomId') roomId: string,
    @Body() body: { hostId: number },
  ) {
    return await this.roomLobbyService.resetRoom(+roomId, body.hostId);
  }

  @Post(':roomId/cancel')
  @ApiOperation({ summary: 'Hủy phòng chờ' })
  @ApiParam({ name: 'roomId', description: 'ID của phòng' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        hostId: { type: 'number', example: 1 },
      },
      required: ['hostId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Phòng đã được hủy',
  })
  async cancelRoom(
    @Param('roomId') roomId: string,
    @Body() body: { hostId: number },
  ) {
    return this.roomLobbyService.cancelRoom(+roomId, body.hostId);
  }

  @Post(':roomId/invite')
  @ApiOperation({ summary: 'Mời người chơi vào phòng' })
  @ApiParam({ name: 'roomId', description: 'ID của phòng' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        hostId: { type: 'number', example: 1 },
        playerId: { type: 'number', example: 2 },
      },
      required: ['hostId', 'playerId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Đã gửi lời mời',
  })
  async invitePlayer(
    @Param('roomId') roomId: string,
    @Body() body: { hostId: number; playerId: number },
  ) {
    return this.roomLobbyService.invitePlayer(
      +roomId,
      body.hostId,
      body.playerId,
    );
  }

  @ApiOperation({ summary: 'Update room dungeon' })
  @ApiParam({ name: 'roomId', type: 'number' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        hostId: { type: 'number' },
        dungeonId: { type: 'number' },
      },
    },
  })
  @Post(':roomId/update-dungeon')
  async updateDungeon(
    @Param('roomId') roomId: string,
    @Body() body: { hostId: number; dungeonId: number },
  ) {
    return await this.roomLobbyService.updateDungeon(
      +roomId,
      body.hostId,
      body.dungeonId,
    );
  }

  @ApiOperation({ summary: 'Kick player from room' })
  @ApiParam({ name: 'roomId', type: 'number' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        hostId: { type: 'number' },
        playerId: { type: 'number' },
      },
    },
  })
  @Post(':roomId/kick')
  async kickPlayer(
    @Param('roomId') roomId: string,
    @Body() body: { hostId: number; playerId: number },
  ) {
    return await this.roomLobbyService.kickPlayer(
      +roomId,
      body.hostId,
      body.playerId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách phòng chờ' })
  @ApiQuery({
    name: 'dungeonId',
    required: false,
    description: 'Lọc theo dungeon ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: RoomStatus,
    description: 'Lọc theo trạng thái phòng',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách phòng chờ',
  })
  async getRoomList(
    @Query('dungeonId') dungeonId?: string,
    @Query('status') status?: RoomStatus,
  ) {
    return this.roomLobbyService.getRoomList(
      dungeonId ? +dungeonId : undefined,
      status,
    );
  }

  @Get(':roomId')
  @ApiOperation({ summary: 'Lấy thông tin phòng chờ' })
  @ApiParam({ name: 'roomId', description: 'ID của phòng' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin phòng chờ',
  })
  @ApiResponse({
    status: 404,
    description: 'Phòng không tồn tại',
  })
  async getRoomById(@Param('roomId') roomId: string) {
    return this.roomLobbyService.getRoomById(+roomId);
  }

  @Get('host/:hostId')
  @ApiOperation({ summary: 'Lấy phòng đang host bởi user' })
  @ApiParam({ name: 'hostId', description: 'ID của host' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin phòng hoặc null nếu không có',
  })
  async getRoomByHost(@Param('hostId') hostId: string) {
    return this.roomLobbyService.getRoomByHostId(+hostId);
  }
}
