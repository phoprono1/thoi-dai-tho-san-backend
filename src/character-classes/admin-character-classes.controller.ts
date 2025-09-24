import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { CharacterClassService } from './character-class.service';
import {
  CreateCharacterClassDto,
  UpdateCharacterClassDto,
  CharacterClassResponseDto,
} from './character-class.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@ApiTags('admin-character-classes')
@Controller('admin/character-classes')
export class AdminCharacterClassesController {
  constructor(private readonly characterClassService: CharacterClassService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Admin: Lấy danh sách tất cả character classes' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách character classes',
  })
  async findAll(): Promise<CharacterClassResponseDto[]> {
    return this.characterClassService.getAllClasses();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Admin: Lấy thông tin character class theo ID' })
  @ApiParam({ name: 'id', description: 'ID của character class' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin character class',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy character class',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CharacterClassResponseDto> {
    const classes = await this.characterClassService.getAllClasses();
    const characterClass = classes.find((cls) => cls.id === id);
    if (!characterClass) {
      throw new Error('Character class not found');
    }
    return characterClass;
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Admin: Tạo character class mới' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Warrior' },
        description: { type: 'string', example: 'A strong melee fighter' },
        type: {
          type: 'string',
          enum: [
            'warrior',
            'mage',
            'archer',
            'assassin',
            'priest',
            'knight',
            'tank',
            'healer',
            'summoner',
            'necromancer',
          ],
        },
        tier: { type: 'number', example: 1, minimum: 1, maximum: 5 },
        requiredLevel: { type: 'number', example: 1, minimum: 1 },
        statBonuses: {
          type: 'object',
          properties: {
            strength: { type: 'number', example: 5, minimum: 0 },
            intelligence: { type: 'number', example: 0, minimum: 0 },
            dexterity: { type: 'number', example: 3, minimum: 0 },
            vitality: { type: 'number', example: 4, minimum: 0 },
            luck: { type: 'number', example: 1, minimum: 0 },
          },
        },
        skillUnlocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              skillId: { type: 'number' },
              skillName: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Character class đã được tạo',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ',
  })
  async create(
    @Body() dto: CreateCharacterClassDto,
  ): Promise<CharacterClassResponseDto> {
    return this.characterClassService.createClass(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Admin: Cập nhật thông tin character class' })
  @ApiParam({ name: 'id', description: 'ID của character class' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Warrior' },
        description: { type: 'string', example: 'A strong melee fighter' },
        type: {
          type: 'string',
          enum: [
            'warrior',
            'mage',
            'archer',
            'assassin',
            'priest',
            'knight',
            'tank',
            'healer',
            'summoner',
            'necromancer',
          ],
        },
        tier: { type: 'number', example: 1, minimum: 1, maximum: 5 },
        requiredLevel: { type: 'number', example: 1, minimum: 1 },
        statBonuses: {
          type: 'object',
          properties: {
            strength: { type: 'number', example: 5, minimum: 0 },
            intelligence: { type: 'number', example: 0, minimum: 0 },
            dexterity: { type: 'number', example: 3, minimum: 0 },
            vitality: { type: 'number', example: 4, minimum: 0 },
            luck: { type: 'number', example: 1, minimum: 0 },
          },
        },
        skillUnlocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              skillId: { type: 'number' },
              skillName: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Character class đã được cập nhật',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy character class',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCharacterClassDto,
  ): Promise<CharacterClassResponseDto> {
    return this.characterClassService.updateClass(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Admin: Xóa character class' })
  @ApiParam({ name: 'id', description: 'ID của character class' })
  @ApiResponse({
    status: 200,
    description: 'Character class đã được xóa',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy character class',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.characterClassService.deleteClass(id);
  }
}
