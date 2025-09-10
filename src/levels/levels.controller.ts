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
import { LevelsService } from './levels.service';
import { Level } from './level.entity';

@ApiTags('levels')
@Controller('levels')
export class LevelsController {
  constructor(private readonly levelsService: LevelsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả levels' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách levels',
  })
  findAll(): Promise<Level[]> {
    return this.levelsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin level theo ID' })
  @ApiParam({ name: 'id', description: 'ID của level' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin level',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy level',
  })
  findOne(@Param('id') id: string): Promise<Level | null> {
    return this.levelsService.findOne(+id);
  }

  @Get('level/:level')
  @ApiOperation({ summary: 'Lấy thông tin level theo số level' })
  @ApiParam({ name: 'level', description: 'Số level' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin level',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy level',
  })
  findByLevel(@Param('level') level: string): Promise<Level | null> {
    return this.levelsService.findByLevel(+level);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo level mới' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        level: { type: 'number', example: 1, minimum: 1 },
        experienceRequired: { type: 'number', example: 100, minimum: 0 },
        maxHp: { type: 'number', example: 100, minimum: 1 },
        maxMp: { type: 'number', example: 50, minimum: 0 },
        attack: { type: 'number', example: 10, minimum: 0 },
        defense: { type: 'number', example: 5, minimum: 0 },
        speed: { type: 'number', example: 8, minimum: 0 },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Level đã được tạo',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ',
  })
  create(@Body() level: Partial<Level>): Promise<Level> {
    return this.levelsService.create(level);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin level' })
  @ApiParam({ name: 'id', description: 'ID của level' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        level: { type: 'number', example: 2 },
        experienceRequired: { type: 'number', example: 200 },
        maxHp: { type: 'number', example: 120 },
        maxMp: { type: 'number', example: 60 },
        attack: { type: 'number', example: 12 },
        defense: { type: 'number', example: 6 },
        speed: { type: 'number', example: 9 },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Level đã được cập nhật',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy level',
  })
  update(
    @Param('id') id: string,
    @Body() level: Partial<Level>,
  ): Promise<Level | null> {
    return this.levelsService.update(+id, level);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa level' })
  @ApiParam({ name: 'id', description: 'ID của level' })
  @ApiResponse({
    status: 200,
    description: 'Level đã được xóa',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy level',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.levelsService.remove(+id);
  }
}
