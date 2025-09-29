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
import { AdvancementService } from './advancement.service';

interface RequestWithUser extends Request {
  user: { id: number };
}

@Controller('character-classes')
export class CharacterClassController {
  constructor(
    private readonly characterClassService: CharacterClassService,
    private readonly advancementService: AdvancementService,
  ) {}

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
  @Post('advancement/awaken')
  async awaken(@Request() req: RequestWithUser): Promise<AdvancementResultDto> {
    return this.characterClassService.awaken(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('advancement/history')
  async getAdvancementHistory(
    @Request() req: RequestWithUser,
  ): Promise<CharacterAdvancementResponseDto[]> {
    return this.characterClassService.getUserAdvancementHistory(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pending-advancements')
  async getPendingAdvancements(@Request() req: RequestWithUser) {
    return this.advancementService.listPendingForUser(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('pending-advancements/:id/accept')
  async acceptPendingAdvancement(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { mappingId: number },
  ) {
    return this.advancementService.acceptPending(
      req.user.id,
      id,
      body.mappingId,
    );
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

  // Pending advancement endpoints
  @Get('advancement/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingAdvancement(@Request() req: RequestWithUser) {
    return this.characterClassService.getPendingAdvancement(req.user.id);
  }

  @Post('advancement/pending/accept')
  @UseGuards(JwtAuthGuard)
  async acceptCurrentPendingAdvancement(@Request() req: RequestWithUser) {
    return this.characterClassService.acceptPendingAdvancement(req.user.id);
  }

  @Delete('advancement/pending')
  @UseGuards(JwtAuthGuard)
  async clearPendingAdvancement(@Request() req: RequestWithUser) {
    return this.characterClassService.clearPendingAdvancement(req.user.id);
  }

  @Post('advancement/pending/create')
  @UseGuards(JwtAuthGuard)
  async createPendingAdvancement(
    @Request() req: RequestWithUser,
    @Body() body: any,
  ) {
    return this.characterClassService.createPendingAdvancement(
      req.user.id,
      body,
    );
  }

  @Get('advancement/check/:targetClassId')
  @UseGuards(JwtAuthGuard)
  async checkAdvancementRequirements(
    @Request() req: RequestWithUser,
    @Param('targetClassId', ParseIntPipe) targetClassId: number,
  ) {
    return this.characterClassService.checkAdvancementRequirements(
      req.user.id,
      targetClassId,
    );
  }
}
