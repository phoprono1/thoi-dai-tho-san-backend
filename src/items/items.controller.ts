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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { Item } from './item.entity';
import { ItemType } from './item-types.enum';
import {
  ClassType,
  ClassTier,
} from '../character-classes/character-class.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../users/user.entity';
import { UserItemsService } from '../user-items/user-items.service';

@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly userItemsService: UserItemsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả items' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách items',
  })
  findAll(): Promise<Item[]> {
    return this.itemsService.findAll();
  }

  @Get('class/:classId')
  @ApiOperation({ summary: 'Lấy danh sách items theo class' })
  @ApiParam({ name: 'classId', description: 'ID của class' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách items có thể sử dụng bởi class này',
  })
  findByClass(@Param('classId') classId: string): Promise<Item[]> {
    return this.itemsService.findByClass(+classId);
  }

  @Get('class-type/:classType')
  @ApiOperation({ summary: 'Lấy danh sách items theo loại class' })
  @ApiParam({
    name: 'classType',
    description: 'Loại class (WARRIOR, MAGE, ARCHER, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách items có thể sử dụng bởi loại class này',
  })
  findByClassType(
    @Param('classType') classType: string,
    @Query('minTier') minTier?: ClassTier,
  ): Promise<Item[]> {
    // Convert string to ClassType enum
    const validClassType = Object.values(ClassType).includes(
      classType as ClassType,
    )
      ? (classType as ClassType)
      : ClassType.WARRIOR; // Default fallback

    return this.itemsService.findByClassType(validClassType, minTier);
  }

  @Get('set/:setId')
  @ApiOperation({ summary: 'Lấy danh sách items trong một set' })
  @ApiParam({ name: 'setId', description: 'ID của item set' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách items thuộc về set này',
  })
  findBySet(@Param('setId') setId: string): Promise<Item[]> {
    return this.itemsService.findBySet(+setId);
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Lấy danh sách items theo loại' })
  @ApiParam({
    name: 'type',
    description:
      'Loại item (weapon, armor, accessory, consumable, material, quest)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách items theo loại',
  })
  findByType(@Param('type') type: string): Promise<Item[]> {
    return this.itemsService.findByType(type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết của một item' })
  @ApiParam({ name: 'id', description: 'ID của item' })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết item (bao gồm itemSet nếu có)',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy item',
  })
  async findOne(@Param('id') id: string): Promise<Item> {
    const item = await this.itemsService.findOne(+id);
    if (!item) {
      throw new HttpException('Item not found', HttpStatus.NOT_FOUND);
    }
    return item;
  }

  @Post()
  @ApiOperation({ summary: 'Tạo item mới' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Iron Sword' },
        type: {
          type: 'string',
          example: 'weapon',
          enum: [
            'weapon',
            'armor',
            'accessory',
            'consumable',
            'material',
            'quest',
          ],
        },
        rarity: { type: 'number', example: 2, minimum: 1, maximum: 5 },
        price: { type: 'number', example: 200 },
        setId: {
          type: 'number',
          example: 1,
          description: 'ID của item set (optional)',
        },
        stats: {
          type: 'object',
          example: { attack: 15, defense: 5 },
        },
        classRestrictions: {
          type: 'object',
          example: {
            allowedClassTypes: ['warrior', 'mage'],
            restrictedClassTypes: ['archer'],
            requiredTier: 2,
            description: 'Only for warriors and mages, requires tier 2+',
          },
          description: 'Giới hạn class có thể sử dụng item này',
        },
        consumableType: {
          type: 'string',
          example: 'hp_potion',
          enum: ['hp_potion', 'mp_potion', 'exp_potion', 'stat_boost'],
        },
        consumableValue: { type: 'number', example: 100 },
        duration: { type: 'number', example: 30 },
        tradable: { type: 'boolean', example: true },
      },
      required: ['name', 'type', 'rarity'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Item đã được tạo',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ',
  })
  create(@Body() item: Partial<Item>): Promise<Item> {
    return this.itemsService.create(item);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin item' })
  @ApiParam({ name: 'id', description: 'ID của item' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Steel Sword' },
        type: {
          type: 'string',
          example: 'weapon',
          enum: [
            'weapon',
            'armor',
            'accessory',
            'consumable',
            'material',
            'quest',
          ],
        },
        rarity: { type: 'number', example: 3 },
        price: { type: 'number', example: 400 },
        setId: {
          type: 'number',
          example: 1,
          description: 'ID của item set (optional)',
        },
        stats: {
          type: 'object',
          example: { attack: 25, critRate: 5 },
        },
        classRestrictions: {
          type: 'object',
          example: {
            allowedClassTypes: ['warrior', 'mage'],
            restrictedClassTypes: ['archer'],
            requiredTier: 2,
            description: 'Only for warriors and mages, requires tier 2+',
          },
          description: 'Giới hạn class có thể sử dụng item này',
        },
        consumableType: {
          type: 'string',
          example: 'hp_potion',
          enum: ['hp_potion', 'mp_potion', 'exp_potion', 'stat_boost'],
        },
        consumableValue: { type: 'number', example: 100 },
        duration: { type: 'number', example: 30 },
        tradable: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Item đã được cập nhật',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy item',
  })
  update(
    @Param('id') id: string,
    @Body() item: Partial<Item>,
  ): Promise<Item | null> {
    return this.itemsService.update(+id, item);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa item' })
  @ApiParam({ name: 'id', description: 'ID của item' })
  @ApiResponse({
    status: 200,
    description: 'Item đã được xóa',
  })
  @ApiResponse({
    status: 400,
    description: 'Không thể xóa item vì đang được sử dụng',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy item',
  })
  async remove(@Param('id') id: string) {
    const result = await this.itemsService.remove(+id);

    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }

    return { message: result.message };
  }

  @Post('create-sample')
  @ApiOperation({ summary: 'Tạo items mẫu (Admin)' })
  @ApiResponse({
    status: 201,
    description: 'Items mẫu đã được tạo',
  })
  async createSampleItems() {
    const sampleItems = [
      {
        name: 'Health Potion',
        type: ItemType.CONSUMABLE,
        rarity: 1,
        price: 50,
        stats: { hp: 50 },
      },
      {
        name: 'Mana Potion',
        type: ItemType.CONSUMABLE,
        rarity: 1,
        price: 60,
        stats: { mp: 30 },
      },
      {
        name: 'Warrior Sword',
        type: ItemType.WEAPON,
        rarity: 2,
        price: 200,
        stats: { attack: 15 },
        classRestrictions: {
          allowedClassTypes: [ClassType.WARRIOR],
          requiredTier: ClassTier.BASIC,
          description: 'Only for Warriors',
        },
      },
      {
        name: 'Mage Staff',
        type: ItemType.WEAPON,
        rarity: 2,
        price: 220,
        stats: { magicAttack: 18 },
        classRestrictions: {
          allowedClassTypes: [ClassType.MAGE],
          requiredTier: ClassTier.BASIC,
          description: 'Only for Mages',
        },
      },
      {
        name: 'Universal Armor',
        type: ItemType.ARMOR,
        rarity: 2,
        price: 150,
        stats: { defense: 10 },
        // No class restrictions - can be used by all classes
      },
      {
        name: 'Magic Ring',
        type: ItemType.ACCESSORY,
        rarity: 3,
        price: 300,
        stats: { critRate: 5, critDamage: 20 },
        classRestrictions: {
          restrictedClassTypes: [ClassType.ARCHER],
          requiredTier: ClassTier.ADVANCED,
          description: 'Cannot be used by Archers',
        },
      },
      {
        name: 'Lucky Charm',
        type: ItemType.CONSUMABLE,
        rarity: 4,
        price: 500,
        stats: { luck: 20 }, // +20% success rate for upgrades
      },
    ];

    const createdItems: Item[] = [];
    for (const itemData of sampleItems) {
      const item = await this.itemsService.create(itemData);
      createdItems.push(item);
    }

    return {
      message: 'Sample items created successfully',
      items: createdItems,
    };
  }
  @Post('sell')
  @UseGuards(JwtAuthGuard)
  async sellItem(
    @CurrentUser() user: User,
    @Body() body: { userItemId: number; quantity?: number },
  ): Promise<{ goldReceived: number; newGoldBalance: number }> {
    if (!body || !body.userItemId) {
      throw new BadRequestException('userItemId is required');
    }

    const qty = Math.max(1, Number(body.quantity) || 1);
    try {
      return await this.userItemsService.sellItem(
        user.id,
        body.userItemId,
        qty,
      );
    } catch (err: unknown) {
      // Log full error for debugging
      console.error('Error in POST /items/sell:', err);
      const getMessage = (e: unknown) => {
        if (!e) return 'Failed to sell item';
        if (typeof e === 'string') return e;
        if (typeof e === 'object' && e && 'message' in e)
          return (e as { message?: unknown }).message as string;
        return 'Failed to sell item';
      };
      throw new InternalServerErrorException(getMessage(err));
    }
  }
}
