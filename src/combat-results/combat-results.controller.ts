import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { CombatResultsService } from './combat-results.service';

@ApiTags('combat')
@Controller('combat')
export class CombatResultsController {
  constructor(private readonly combatResultsService: CombatResultsService) {}

  @Post('start')
  @ApiOperation({ summary: 'Bắt đầu trận chiến' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userIds: {
          type: 'array',
          items: { type: 'number' },
          example: [1, 2],
          description: 'Danh sách ID người chơi tham gia',
        },
        dungeonId: {
          type: 'number',
          example: 1,
          description: 'ID của dungeon',
        },
      },
      required: ['userIds', 'dungeonId'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Trận chiến đã bắt đầu',
    schema: {
      type: 'object',
      properties: {
        result: {
          type: 'string',
          example: 'victory',
          enum: ['victory', 'defeat'],
        },
        duration: { type: 'number', example: 2500 },
        rewards: {
          type: 'object',
          properties: {
            experience: { type: 'number', example: 100 },
            gold: { type: 'number', example: 50 },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  itemId: { type: 'number', example: 1 },
                  quantity: { type: 'number', example: 2 },
                },
              },
            },
          },
        },
        logs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              turn: { type: 'number', example: 1 },
              actionOrder: { type: 'number', example: 1 },
              action: { type: 'string', example: 'attack' },
              userId: { type: 'number', example: 1 },
              details: {
                type: 'object',
                properties: {
                  actor: { type: 'string', example: 'player' },
                  actorName: { type: 'string', example: 'hoangpho' },
                  targetName: { type: 'string', example: 'Goblin' },
                  damage: { type: 'number', example: 25 },
                  hpBefore: { type: 'number', example: 100 },
                  hpAfter: { type: 'number', example: 75 },
                  description: {
                    type: 'string',
                    example: 'hoangpho attacks Goblin for 25 damage',
                  },
                  effects: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['Chí mạng! x1.5', 'Hút máu +3 HP'],
                  },
                },
              },
            },
          },
        },
        teamStats: {
          type: 'object',
          properties: {
            totalHp: { type: 'number', example: 100 },
            currentHp: { type: 'number', example: 75 },
            members: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'number', example: 1 },
                  username: { type: 'string', example: 'hoangpho' },
                  hp: { type: 'number', example: 75 },
                  maxHp: { type: 'number', example: 100 },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ hoặc không đủ stamina',
  })
  async startCombat(@Body() body: { userIds: number[]; dungeonId: number }) {
    return this.combatResultsService.startCombat(body.userIds, body.dungeonId);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả kết quả chiến đấu' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách kết quả chiến đấu',
  })
  findAll() {
    return this.combatResultsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy kết quả chiến đấu theo ID' })
  @ApiParam({ name: 'id', description: 'ID của kết quả chiến đấu' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin kết quả chiến đấu',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy kết quả chiến đấu',
  })
  findOne(@Param('id') id: string) {
    return this.combatResultsService.findOne(+id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Lấy lịch sử chiến đấu của người chơi' })
  @ApiParam({ name: 'userId', description: 'ID của người chơi' })
  @ApiResponse({
    status: 200,
    description: 'Lịch sử chiến đấu của người chơi',
  })
  findByUser(@Param('userId') userId: string) {
    return this.combatResultsService.findByUser(+userId);
  }
}
