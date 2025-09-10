import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Delete,
  Put,
} from '@nestjs/common';
import { CharacterClassService } from './character-class.service';
import {
  CreateCharacterClassDto,
  CharacterClassResponseDto,
  AdvancementCheckResultDto,
  PerformAdvancementDto,
  AdvancementResultDto,
  CharacterAdvancementResponseDto,
  UpdateCharacterClassDto,
} from './character-class.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface RequestWithUser extends Request {
  user: { id: number };
}

@Controller('character-classes')
export class CharacterClassController {
  constructor(private readonly characterClassService: CharacterClassService) {}

  @Post()
  async createClass(
    @Body() dto: CreateCharacterClassDto,
  ): Promise<CharacterClassResponseDto> {
    return this.characterClassService.createClass(dto);
  }

  @Get()
  async getAllClasses(): Promise<CharacterClassResponseDto[]> {
    return this.characterClassService.getAllClasses();
  }

  @Get('tier/:tier')
  async getClassesByTier(
    @Param('tier', ParseIntPipe) tier: number,
  ): Promise<CharacterClassResponseDto[]> {
    return this.characterClassService.getClassesByTier(tier);
  }

  @Get(':id')
  async getClassById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CharacterClassResponseDto> {
    const classes = await this.characterClassService.getAllClasses();
    const characterClass = classes.find((cls) => cls.id === id);
    if (!characterClass) {
      throw new Error('Class not found');
    }
    return characterClass;
  }

  @UseGuards(JwtAuthGuard)
  @Get('advancement/available')
  async getAvailableAdvancements(
    @Request() req: RequestWithUser,
  ): Promise<AdvancementCheckResultDto> {
    return this.characterClassService.getAvailableAdvancements(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('advancement/perform')
  async performAdvancement(
    @Request() req: RequestWithUser,
    @Body() dto: PerformAdvancementDto,
  ): Promise<AdvancementResultDto> {
    dto.userId = req.user.id;
    return this.characterClassService.performAdvancement(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('advancement/history')
  async getAdvancementHistory(
    @Request() req: RequestWithUser,
  ): Promise<CharacterAdvancementResponseDto[]> {
    return this.characterClassService.getUserAdvancementHistory(req.user.id);
  }

  @Delete(':id')
  async deleteClass(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.characterClassService.deleteClass(id);
  }

  @Put(':id')
  async updateClass(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCharacterClassDto,
  ): Promise<CharacterClassResponseDto> {
    return this.characterClassService.updateClass(id, dto);
  }
}
