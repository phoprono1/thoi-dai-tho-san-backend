import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UserStatsService } from './user-stats.service';
import { UserStat } from './user-stat.entity';

@ApiTags('user-stats')
@Controller('user-stats')
export class UserStatsController {
  constructor(private readonly userStatsService: UserStatsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả user stats' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách user stats',
  })
  findAll(): Promise<UserStat[]> {
    return this.userStatsService.findAll();
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Lấy user stats theo user ID' })
  @ApiParam({ name: 'userId', description: 'ID của user' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin user stats',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy user stats',
  })
  findByUserId(@Param('userId') userId: string): Promise<UserStat | null> {
    return this.userStatsService.findByUserId(+userId);
  }

  // Debug endpoint to check user stats with guild buffs
  @Get('debug/:userId/with-guild-buffs')
  async debugUserStatsWithGuildBuffs(
    @Param('userId') userId: string,
  ): Promise<any> {
    const userStats = await this.userStatsService.findByUserId(+userId);
    const totalStats =
      await this.userStatsService.getTotalStatsWithAllBonuses(+userId);

    return {
      baseStats: userStats,
      totalStatsWithAllBonuses: totalStats,
      userId: +userId,
    };
  }

  @Get('user/:userId/total-stats')
  @ApiOperation({
    summary: 'Lấy tổng core attributes bao gồm tất cả buff sources',
  })
  @ApiParam({ name: 'userId', description: 'ID của user' })
  @ApiResponse({
    status: 200,
    description: 'Tổng core attributes với tất cả bonuses',
    schema: {
      type: 'object',
      properties: {
        str: { type: 'number', example: 25 },
        int: { type: 'number', example: 22 },
        dex: { type: 'number', example: 20 },
        vit: { type: 'number', example: 28 },
        luk: { type: 'number', example: 15 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy user stats',
  })
  getTotalStatsWithAllBonuses(@Param('userId') userId: string) {
    return this.userStatsService.getTotalStatsWithAllBonuses(+userId);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo user stats mới' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', example: 1 },
        maxHp: { type: 'number', example: 100 },
        currentHp: { type: 'number', example: 100 },
        attack: { type: 'number', example: 20 },
        defense: { type: 'number', example: 10 },
        critRate: { type: 'number', example: 5 },
        critDamage: { type: 'number', example: 150 },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User stats đã được tạo',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ',
  })
  create(@Body() userStat: Partial<UserStat>): Promise<UserStat> {
    return this.userStatsService.create(userStat);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật user stats' })
  @ApiParam({ name: 'id', description: 'ID của user stat' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        maxHp: { type: 'number', example: 120 },
        currentHp: { type: 'number', example: 120 },
        attack: { type: 'number', example: 25 },
        defense: { type: 'number', example: 12 },
        critRate: { type: 'number', example: 7 },
        critDamage: { type: 'number', example: 160 },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User stats đã được cập nhật',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy user stat',
  })
  update(
    @Param('id') id: string,
    @Body() userStat: Partial<UserStat>,
  ): Promise<UserStat | null> {
    return this.userStatsService.update(+id, userStat);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa user stats' })
  @ApiParam({ name: 'id', description: 'ID của user stat' })
  @ApiResponse({
    status: 200,
    description: 'User stats đã được xóa',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy user stat',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.userStatsService.remove(+id);
  }
}
