import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkillDefinitionService } from './skill-definition.service';
import { SkillDefinitionData } from './skill-definition.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('admin/skill-definitions')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SkillDefinitionController {
  constructor(
    private readonly skillDefinitionService: SkillDefinitionService,
  ) {}

  // Get all skill definitions
  @Get()
  async getAllSkillDefinitions(): Promise<SkillDefinitionData[]> {
    return this.skillDefinitionService.getAllSkillDefinitions();
  }

  // Get skill definition by ID
  @Get(':skillId')
  async getSkillDefinition(
    @Param('skillId') skillId: string,
  ): Promise<SkillDefinitionData | null> {
    return this.skillDefinitionService.getSkillDefinitionById(skillId);
  }

  // Get skill definitions by category
  @Get('category/:category')
  async getSkillDefinitionsByCategory(
    @Param('category') category: string,
  ): Promise<SkillDefinitionData[]> {
    return this.skillDefinitionService.getSkillDefinitionsByCategory(category);
  }

  // Create new skill definition
  @Post()
  async createSkillDefinition(@Body() data: Omit<SkillDefinitionData, 'id'>) {
    // Validate input
    const errors = this.skillDefinitionService.validateSkillDefinition(data);
    if (errors.length > 0) {
      return {
        success: false,
        message: 'Validation failed',
        errors,
      };
    }

    try {
      const skill =
        await this.skillDefinitionService.createSkillDefinition(data);
      return {
        success: true,
        message: 'Skill definition created successfully',
        data: skill.toSkillDefinition(),
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Update skill definition
  @Put(':skillId')
  async updateSkillDefinition(
    @Param('skillId') skillId: string,
    @Body() data: Partial<SkillDefinitionData>,
  ) {
    // Validate input
    const errors = this.skillDefinitionService.validateSkillDefinition(data);
    if (errors.length > 0) {
      return {
        success: false,
        message: 'Validation failed',
        errors,
      };
    }

    try {
      const skill = await this.skillDefinitionService.updateSkillDefinition(
        skillId,
        data,
      );
      return {
        success: true,
        message: 'Skill definition updated successfully',
        data: skill.toSkillDefinition(),
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Soft delete skill definition
  @Delete(':skillId')
  async deleteSkillDefinition(@Param('skillId') skillId: string) {
    try {
      await this.skillDefinitionService.deleteSkillDefinition(skillId);
      return {
        success: true,
        message: 'Skill definition deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Hard delete skill definition (dangerous)
  @Delete(':skillId/hard')
  async hardDeleteSkillDefinition(@Param('skillId') skillId: string) {
    try {
      await this.skillDefinitionService.hardDeleteSkillDefinition(skillId);
      return {
        success: true,
        message: 'Skill definition permanently deleted',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Get available skills for user (helper endpoint for testing)
  @Get('available/:userLevel/:attributeValue/:attributeType')
  async getAvailableSkillsForUser(
    @Param('userLevel') userLevel: string,
    @Param('attributeValue') attributeValue: string,
    @Param('attributeType')
    attributeType: 'STR' | 'INT' | 'DEX' | 'VIT' | 'LUK',
  ): Promise<SkillDefinitionData[]> {
    const level = parseInt(userLevel);
    const attrValue = parseInt(attributeValue);

    if (isNaN(level) || isNaN(attrValue)) {
      throw new Error('Invalid parameters');
    }

    return this.skillDefinitionService.getAvailableSkillsForUser(
      level,
      attrValue,
      attributeType,
    );
  }
}
