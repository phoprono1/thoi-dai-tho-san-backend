import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ClassesService } from './classes.service';

@ApiTags('classes')
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  // Create sample classes (admin only)
  @Post('create-sample')
  @ApiOperation({ summary: 'Tạo classes mẫu (Admin)' })
  @ApiResponse({ status: 201, description: 'Classes đã được tạo thành công' })
  async createSampleClasses() {
    return this.classesService.createSampleClasses();
  }

  // Get all classes
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả classes' })
  @ApiResponse({ status: 200, description: 'Danh sách classes' })
  async findAll() {
    return this.classesService.findAll();
  }

  // Get class by ID
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin class theo ID' })
  @ApiParam({ name: 'id', description: 'ID của class' })
  @ApiResponse({ status: 200, description: 'Thông tin class' })
  async findOne(@Param('id') id: string) {
    return this.classesService.findOne(+id);
  }

  // Get user's classes
  @Get('user/:userId')
  @ApiOperation({ summary: 'Lấy danh sách classes của user' })
  @ApiParam({ name: 'userId', description: 'ID của user' })
  @ApiResponse({ status: 200, description: 'Danh sách classes đã unlock' })
  async getUserClasses(@Param('userId') userId: string) {
    return this.classesService.getUserClasses(+userId);
  }

  // Get user's active class
  @Get('user/:userId/active')
  @ApiOperation({ summary: 'Lấy class đang active của user' })
  @ApiParam({ name: 'userId', description: 'ID của user' })
  @ApiResponse({ status: 200, description: 'Class đang active' })
  async getUserActiveClass(@Param('userId') userId: string) {
    return this.classesService.getUserActiveClass(+userId);
  }

  // Get user's class bonuses
  @Get('user/:userId/bonuses')
  @ApiOperation({ summary: 'Lấy bonus stats từ class active' })
  @ApiParam({ name: 'userId', description: 'ID của user' })
  @ApiResponse({ status: 200, description: 'Bonus stats từ class' })
  async getClassBonuses(@Param('userId') userId: string) {
    return this.classesService.getClassBonuses(+userId);
  }

  // Unlock class for user
  @Post('user/:userId/unlock/:classId')
  @ApiOperation({ summary: 'Unlock class cho user' })
  @ApiParam({ name: 'userId', description: 'ID của user' })
  @ApiParam({ name: 'classId', description: 'ID của class cần unlock' })
  @ApiResponse({ status: 201, description: 'Class đã được unlock' })
  async unlockClass(
    @Param('userId') userId: string,
    @Param('classId') classId: string,
  ) {
    return this.classesService.unlockClass(+userId, +classId);
  }

  // Set active class for user
  @Put('user/:userId/active/:userClassId')
  @ApiOperation({ summary: 'Set class active cho user' })
  @ApiParam({ name: 'userId', description: 'ID của user' })
  @ApiParam({ name: 'userClassId', description: 'ID của user_class' })
  @ApiResponse({ status: 200, description: 'Active class đã được cập nhật' })
  async setActiveClass(
    @Param('userId') userId: string,
    @Param('userClassId') userClassId: string,
  ) {
    return this.classesService.setActiveClass(+userId, +userClassId);
  }
}
