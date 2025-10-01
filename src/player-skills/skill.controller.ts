import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkillService } from './skill.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkillId } from './player-skill.entity';

@ApiTags('skills')
@Controller('skills')
@UseGuards(JwtAuthGuard)
export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  @Get()
  @ApiOperation({ summary: 'Get all player skills' })
  @ApiResponse({
    status: 200,
    description: 'List of player skills',
  })
  async getPlayerSkills(@Request() req) {
    const userId = req.user.id;
    return this.skillService.getPlayerSkills(userId);
  }

  @Get('available')
  @ApiOperation({ summary: 'Get skills available for unlocking' })
  @ApiResponse({
    status: 200,
    description: 'List of available skills',
  })
  async getAvailableSkills(@Request() req) {
    const userId = req.user.id;
    return this.skillService.getAvailableSkills(userId);
  }

  @Post('unlock/:skillId')
  @ApiOperation({ summary: 'Unlock a skill' })
  @ApiResponse({
    status: 201,
    description: 'Skill unlocked successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Skill already unlocked or requirements not met',
  })
  async unlockSkill(@Request() req, @Param('skillId') skillId: SkillId) {
    const userId = req.user.id;
    return this.skillService.unlockSkill(userId, skillId);
  }

  @Post('level-up/:skillId')
  @ApiOperation({ summary: 'Level up a skill' })
  @ApiResponse({
    status: 200,
    description: 'Skill leveled up successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Skill not unlocked or already at max level',
  })
  async levelUpSkill(@Request() req, @Param('skillId') skillId: SkillId) {
    const userId = req.user.id;
    return this.skillService.levelUpSkill(userId, skillId);
  }

  @Get('effects')
  @ApiOperation({ summary: 'Get skill effects for combat calculations' })
  @ApiResponse({
    status: 200,
    description: 'Skill effects applied to player',
  })
  async getSkillEffects(@Request() req) {
    const userId = req.user.id;
    return this.skillService.getPlayerSkillEffects(userId);
  }

  @Post('equip/:skillId')
  @ApiOperation({ summary: 'Equip a skill' })
  @ApiResponse({
    status: 200,
    description: 'Skill equipped successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Skill not found or slot limit reached',
  })
  async equipSkill(@Request() req, @Param('skillId') skillId: SkillId) {
    const userId = req.user.id;
    return this.skillService.equipSkill(userId, skillId);
  }

  @Post('unequip/:skillId')
  @ApiOperation({ summary: 'Unequip a skill' })
  @ApiResponse({
    status: 200,
    description: 'Skill unequipped successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Skill not found or not equipped',
  })
  async unequipSkill(@Request() req, @Param('skillId') skillId: SkillId) {
    const userId = req.user.id;
    return this.skillService.unequipSkill(userId, skillId);
  }

  @Get('slots')
  @ApiOperation({ summary: 'Get equipped skill slots info' })
  @ApiResponse({
    status: 200,
    description: 'Equipped slots information',
  })
  async getEquippedSlots(@Request() req) {
    const userId = req.user.id;
    return this.skillService.getEquippedSlotsInfo(userId);
  }
}
