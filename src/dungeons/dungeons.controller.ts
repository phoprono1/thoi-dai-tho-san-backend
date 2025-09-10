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
import { DungeonsService } from './dungeons.service';
import { Dungeon } from './dungeon.entity';

@ApiTags('dungeons')
@Controller('dungeons')
export class DungeonsController {
  constructor(private readonly dungeonsService: DungeonsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả dungeons' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách dungeons',
  })
  findAll(): Promise<Dungeon[]> {
    return this.dungeonsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin dungeon theo ID' })
  @ApiParam({ name: 'id', description: 'ID của dungeon' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin dungeon',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy dungeon',
  })
  findOne(@Param('id') id: string): Promise<Dungeon | null> {
    return this.dungeonsService.findOne(+id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo dungeon mới' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Dark Forest' },
        levelRequirement: { type: 'number', example: 1, minimum: 1 },
        isHidden: { type: 'boolean', example: false },
        requiredItem: { type: 'number', example: 1, nullable: true },
        monsterIds: {
          type: 'array',
          items: { type: 'number' },
          example: [1, 2, 3],
        },
        monsterCounts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              monsterId: { type: 'number' },
              count: { type: 'number', minimum: 1 },
            },
          },
          example: [
            { monsterId: 1, count: 2 },
            { monsterId: 2, count: 1 },
          ],
        },
        dropItems: {
          type: 'array',
          nullable: true,
          items: {
            type: 'object',
            properties: {
              itemId: { type: 'number' },
              dropRate: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
          example: [
            { itemId: 1, dropRate: 0.5 },
            { itemId: 2, dropRate: 0.1 },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Dungeon đã được tạo',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ',
  })
  create(@Body() dungeon: Partial<Dungeon>): Promise<Dungeon> {
    return this.dungeonsService.create(dungeon);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin dungeon' })
  @ApiParam({ name: 'id', description: 'ID của dungeon' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Mystic Cave' },
        levelRequirement: { type: 'number', example: 2 },
        isHidden: { type: 'boolean', example: false },
        requiredItem: { type: 'number', example: 2, nullable: true },
        monsterIds: {
          type: 'array',
          items: { type: 'number' },
          example: [1, 2, 3],
        },
        monsterCounts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              monsterId: { type: 'number' },
              count: { type: 'number', minimum: 1 },
            },
          },
          example: [
            { monsterId: 1, count: 2 },
            { monsterId: 2, count: 1 },
          ],
        },
        dropItems: {
          type: 'array',
          nullable: true,
          items: {
            type: 'object',
            properties: {
              itemId: { type: 'number' },
              dropRate: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
          example: [
            { itemId: 1, dropRate: 0.5 },
            { itemId: 2, dropRate: 0.1 },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Dungeon đã được cập nhật',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy dungeon',
  })
  update(
    @Param('id') id: string,
    @Body() dungeon: Partial<Dungeon>,
  ): Promise<Dungeon | null> {
    return this.dungeonsService.update(+id, dungeon);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa dungeon' })
  @ApiParam({ name: 'id', description: 'ID của dungeon' })
  @ApiResponse({
    status: 200,
    description: 'Dungeon đã được xóa',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy dungeon',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.dungeonsService.remove(+id);
  }
}
