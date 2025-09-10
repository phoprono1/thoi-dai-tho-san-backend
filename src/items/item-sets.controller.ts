/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ItemSetsService } from './item-sets.service';
import { ItemSet } from './item-set.entity';

@ApiTags('item-sets')
@Controller('item-sets')
export class ItemSetsController {
  constructor(private readonly itemSetsService: ItemSetsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả item sets' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách item sets',
  })
  findAll(): Promise<ItemSet[]> {
    return this.itemSetsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin item set theo ID' })
  @ApiParam({ name: 'id', description: 'ID của item set' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin item set',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy item set',
  })
  findOne(@Param('id') id: string): Promise<ItemSet | null> {
    return this.itemSetsService.findOne(+id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo item set mới' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Dragon Slayer Set' },
        description: {
          type: 'string',
          example: 'Full set bonus for dragon hunters',
        },
        rarity: { type: 'number', example: 4, minimum: 1, maximum: 5 },
        setBonuses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pieces: { type: 'number', example: 2 },
              type: { type: 'string', enum: ['flat', 'percentage'] },
              stats: { type: 'object', example: { attack: 50, critRate: 10 } },
              description: {
                type: 'string',
                example: '2-piece: +50 ATK, +10% Crit Rate',
              },
            },
          },
        },
        itemIds: {
          type: 'array',
          items: { type: 'number' },
          example: [1, 2, 3, 4],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Item set đã được tạo',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ',
  })
  async create(
    @Body()
    itemSetData: {
      name: string;
      description?: string;
      rarity: number;
      setBonuses: any[];
      itemIds: number[];
    },
  ): Promise<ItemSet> {
    // Validate required fields
    if (
      !itemSetData.name ||
      !itemSetData.setBonuses ||
      itemSetData.setBonuses.length === 0
    ) {
      throw new HttpException(
        'Name and set bonuses are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Create item set with items
    const itemSet = await this.itemSetsService.create({
      name: itemSetData.name,
      description: itemSetData.description,
      rarity: itemSetData.rarity || 1,
      setBonuses: itemSetData.setBonuses,
      items: itemSetData.itemIds?.map((id) => ({ id }) as any) || [],
    });

    return itemSet;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin item set' })
  @ApiParam({ name: 'id', description: 'ID của item set' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Updated Dragon Set' },
        description: { type: 'string', example: 'Updated description' },
        rarity: { type: 'number', example: 5 },
        setBonuses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pieces: { type: 'number', example: 3 },
              type: { type: 'string', enum: ['flat', 'percentage'] },
              stats: { type: 'object', example: { defense: 100, hp: 500 } },
              description: {
                type: 'string',
                example: '3-piece: +100 DEF, +500 HP',
              },
            },
          },
        },
        itemIds: {
          type: 'array',
          items: { type: 'number' },
          example: [1, 2, 3, 4, 5],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Item set đã được cập nhật',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy item set',
  })
  async update(
    @Param('id') id: string,
    @Body()
    itemSetData: Partial<{
      name: string;
      description: string;
      rarity: number;
      setBonuses: any[];
      itemIds: number[];
    }>,
  ): Promise<ItemSet | null> {
    const updateData: any = { ...itemSetData };

    // Handle items update
    if (itemSetData.itemIds) {
      updateData.items = itemSetData.itemIds.map((id) => ({ id }) as any);
    }

    const updatedItemSet = await this.itemSetsService.update(+id, updateData);

    if (!updatedItemSet) {
      throw new HttpException('Item set not found', HttpStatus.NOT_FOUND);
    }

    return updatedItemSet;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa item set' })
  @ApiParam({ name: 'id', description: 'ID của item set' })
  @ApiResponse({
    status: 200,
    description: 'Item set đã được xóa',
  })
  @ApiResponse({
    status: 400,
    description: 'Không thể xóa item set',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy item set',
  })
  async remove(@Param('id') id: string) {
    const result = await this.itemSetsService.remove(+id);

    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }

    return { message: result.message };
  }

  @Get('rarity/:rarity')
  @ApiOperation({ summary: 'Lấy item sets theo rarity' })
  @ApiParam({ name: 'rarity', description: 'Rarity level (1-5)' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách item sets theo rarity',
  })
  findByRarity(@Param('rarity') rarity: string): Promise<ItemSet[]> {
    return this.itemSetsService.findByRarity(+rarity);
  }
}
