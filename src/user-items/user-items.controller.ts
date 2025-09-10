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
import { UserItemsService } from './user-items.service';
import { UserItem } from './user-item.entity';

@ApiTags('user-items')
@Controller('user-items')
export class UserItemsController {
  constructor(private readonly userItemsService: UserItemsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả user items' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách user items',
  })
  findAll(): Promise<UserItem[]> {
    return this.userItemsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin user item theo ID' })
  @ApiParam({ name: 'id', description: 'ID của user item' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin user item',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy user item',
  })
  findOne(@Param('id') id: string): Promise<UserItem | null> {
    return this.userItemsService.findOne(+id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Lấy danh sách items của người chơi' })
  @ApiParam({ name: 'userId', description: 'ID của người chơi' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách items của người chơi',
  })
  findByUserId(@Param('userId') userId: string): Promise<UserItem[]> {
    return this.userItemsService.findByUserId(+userId);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo user item mới' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', example: 1 },
        itemId: { type: 'number', example: 1 },
        quantity: { type: 'number', example: 1, minimum: 1 },
        equipped: { type: 'boolean', example: false },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User item đã được tạo',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ',
  })
  create(@Body() userItem: Partial<UserItem>): Promise<UserItem> {
    return this.userItemsService.create(userItem);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin user item' })
  @ApiParam({ name: 'id', description: 'ID của user item' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', example: 1 },
        itemId: { type: 'number', example: 2 },
        quantity: { type: 'number', example: 5 },
        equipped: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User item đã được cập nhật',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy user item',
  })
  update(
    @Param('id') id: string,
    @Body() userItem: Partial<UserItem>,
  ): Promise<UserItem | null> {
    return this.userItemsService.update(+id, userItem);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa user item' })
  @ApiParam({ name: 'id', description: 'ID của user item' })
  @ApiResponse({
    status: 200,
    description: 'User item đã được xóa',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy user item',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.userItemsService.remove(+id);
  }

  @Post('add')
  @ApiOperation({ summary: 'Thêm item vào inventory của người chơi' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', example: 1 },
        itemId: { type: 'number', example: 1 },
        quantity: { type: 'number', example: 1, minimum: 1 },
      },
      required: ['userId', 'itemId'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Item đã được thêm vào inventory',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ',
  })
  async addItem(
    @Body() body: { userId: number; itemId: number; quantity?: number },
  ) {
    return this.userItemsService.addItemToUser(
      body.userId,
      body.itemId,
      body.quantity || 1,
    );
  }

  @Post('remove')
  @ApiOperation({ summary: 'Loại bỏ item khỏi inventory của người chơi' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', example: 1 },
        itemId: { type: 'number', example: 1 },
        quantity: { type: 'number', example: 1, minimum: 1 },
      },
      required: ['userId', 'itemId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Item đã được loại bỏ khỏi inventory',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ hoặc không đủ số lượng item',
  })
  async removeItem(
    @Body() body: { userId: number; itemId: number; quantity?: number },
  ) {
    return this.userItemsService.removeItemFromUser(
      body.userId,
      body.itemId,
      body.quantity || 1,
    );
  }

  @Post('upgrade/:userItemId')
  @ApiOperation({ summary: 'Nâng cấp vũ khí' })
  @ApiParam({
    name: 'userItemId',
    description: 'ID của user item cần nâng cấp',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        useLuckyCharm: {
          type: 'boolean',
          example: false,
          description: 'Có sử dụng bùa may mắn không',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả nâng cấp',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        newLevel: { type: 'number', example: 2 },
        cost: { type: 'number', example: 150 },
        luckyCharmsUsed: { type: 'number', example: 0 },
        finalSuccessRate: { type: 'number', example: 80 },
        roll: { type: 'number', example: 45.2 },
        userItem: { type: 'object' },
        statsBonus: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Lỗi nâng cấp',
  })
  async upgradeWeapon(
    @Param('userItemId') userItemId: string,
    @Body() body: { useLuckyCharm?: boolean },
  ) {
    return this.userItemsService.upgradeWeapon(
      +userItemId,
      body.useLuckyCharm || false,
    );
  }

  @Get('upgrade-info/:userItemId')
  @ApiOperation({ summary: 'Lấy thông tin nâng cấp của item' })
  @ApiParam({ name: 'userItemId', description: 'ID của user item' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin nâng cấp',
    schema: {
      type: 'object',
      properties: {
        userItem: { type: 'object' },
        nextLevel: { type: 'number', example: 2 },
        cost: { type: 'number', example: 150 },
        baseSuccessRate: { type: 'number', example: 80 },
        canUpgrade: { type: 'boolean', example: true },
      },
    },
  })
  async getUpgradeInfo(@Param('userItemId') userItemId: string) {
    return this.userItemsService.getUpgradeInfo(+userItemId);
  }

  @Get('upgrade-history/:userItemId')
  @ApiOperation({ summary: 'Lịch sử nâng cấp của item' })
  @ApiParam({ name: 'userItemId', description: 'ID của user item' })
  @ApiResponse({
    status: 200,
    description: 'Lịch sử nâng cấp',
  })
  async getUpgradeHistory(@Param('userItemId') userItemId: string) {
    return this.userItemsService.getUpgradeHistory(+userItemId);
  }

  @Put('equip/:userItemId')
  @ApiOperation({ summary: 'Trang bị/tháo trang bị item' })
  @ApiParam({ name: 'userItemId', description: 'ID của user item' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        equip: {
          type: 'boolean',
          example: true,
          description: 'true = trang bị, false = tháo trang bị',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái trang bị',
  })
  async equipItem(
    @Param('userItemId') userItemId: string,
    @Body() body: { equip: boolean },
  ) {
    return this.userItemsService.equipItem(+userItemId, body.equip);
  }

  @Get('equipped/:userId')
  @ApiOperation({ summary: 'Lấy danh sách items đã trang bị' })
  @ApiParam({ name: 'userId', description: 'ID của user' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách items đã trang bị',
  })
  async getEquippedItems(@Param('userId') userId: string) {
    return this.userItemsService.getEquippedItems(+userId);
  }

  @Post('use/:userItemId')
  @ApiOperation({ summary: 'Sử dụng vật phẩm tiêu thụ' })
  @ApiParam({ name: 'userItemId', description: 'ID của user item cần sử dụng' })
  @ApiResponse({
    status: 200,
    description: 'Kết quả sử dụng vật phẩm',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Đã hồi 50 HP' },
        effects: {
          type: 'object',
          example: { healAmount: 50, newHp: 150, maxHp: 200 },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Lỗi khi sử dụng vật phẩm',
  })
  async useConsumableItem(@Param('userItemId') userItemId: string) {
    return this.userItemsService.useConsumableItem(+userItemId);
  }
}
