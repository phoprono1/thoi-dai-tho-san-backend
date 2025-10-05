/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SkillDefinition,
  SkillDefinitionData,
} from './skill-definition.entity';
import { PlayerSkill } from './player-skill.entity';

@Injectable()
export class SkillDefinitionService {
  constructor(
    @InjectRepository(SkillDefinition)
    private skillDefinitionRepository: Repository<SkillDefinition>,
    @InjectRepository(PlayerSkill)
    private playerSkillRepository: Repository<PlayerSkill>,
  ) {}

  // Get all active skill definitions
  async getAllSkillDefinitions(): Promise<SkillDefinitionData[]> {
    const skills = await this.skillDefinitionRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', skillId: 'ASC' },
    });

    return skills.map((skill) => skill.toSkillDefinition());
  }

  // Get skill definition by skillId
  async getSkillDefinitionById(
    skillId: string,
  ): Promise<SkillDefinitionData | null> {
    const skill = await this.skillDefinitionRepository.findOne({
      where: { skillId, isActive: true },
    });

    return skill ? skill.toSkillDefinition() : null;
  }

  // Get skill definitions by category
  async getSkillDefinitionsByCategory(
    category: string,
  ): Promise<SkillDefinitionData[]> {
    const skills = await this.skillDefinitionRepository.find({
      where: { category, isActive: true },
      order: { sortOrder: 'ASC', skillId: 'ASC' },
    });

    return skills.map((skill) => skill.toSkillDefinition());
  }

  // Admin: Create new skill definition
  async createSkillDefinition(
    data: any, // Allow flexible input for seeding
  ): Promise<SkillDefinition> {
    // Check if skillId already exists
    const skillId =
      data.skillId || data.name.toLowerCase().replace(/\s+/g, '_');
    const existing = await this.skillDefinitionRepository.findOne({
      where: { skillId },
    });

    if (existing) {
      throw new BadRequestException(
        `Skill with ID '${skillId}' already exists`,
      );
    }

    const skill = this.skillDefinitionRepository.create({
      skillId,
      name: data.name,
      description: data.description,
      maxLevel: data.maxLevel || 5,
      requiredAttribute: data.requiredAttribute,
      requiredAttributeValue: data.requiredAttributeValue || 0,
      requiredLevel: data.requiredLevel || 1,
      skillPointCost: data.skillPointCost || 1,
      effects: data.effects,
      isActive: data.isActive !== undefined ? data.isActive : true,
      sortOrder: data.sortOrder || 0,
      category: data.category,
      skillType: data.skillType || 'passive',
      manaCost: data.manaCost,
      cooldown: data.cooldown,
      targetType: data.targetType,
      damageType: data.damageType,
      damageFormula: data.damageFormula,
      healingFormula: data.healingFormula,
    });

    return this.skillDefinitionRepository.save(skill);
  }

  // Admin: Update skill definition
  async updateSkillDefinition(
    skillId: string,
    data: Partial<SkillDefinitionData>,
  ): Promise<SkillDefinition> {
    const skill = await this.skillDefinitionRepository.findOne({
      where: { skillId },
    });

    if (!skill) {
      throw new NotFoundException(
        `Skill definition with ID '${skillId}' not found`,
      );
    }

    // Update fields
    if (data.name) skill.name = data.name;
    if (data.description) skill.description = data.description;
    if (data.maxLevel !== undefined) skill.maxLevel = data.maxLevel;
    if (data.requiredAttribute)
      skill.requiredAttribute = data.requiredAttribute;
    if (data.requiredAttributeValue !== undefined)
      skill.requiredAttributeValue = data.requiredAttributeValue;
    if (data.requiredLevel !== undefined)
      skill.requiredLevel = data.requiredLevel;
    if (data.skillPointCost !== undefined)
      skill.skillPointCost = data.skillPointCost;
    if (data.effects) skill.effects = data.effects;
    if (data.isActive !== undefined) skill.isActive = data.isActive;
    if (data.sortOrder !== undefined) skill.sortOrder = data.sortOrder;
    if (data.category !== undefined) skill.category = data.category;
    if (data.image !== undefined) skill.image = data.image; // Support image upload

    // Update active skill fields
    if (data.skillType !== undefined) skill.skillType = data.skillType;
    if (data.manaCost !== undefined) skill.manaCost = data.manaCost;
    if (data.cooldown !== undefined) skill.cooldown = data.cooldown;
    if (data.targetType !== undefined) skill.targetType = data.targetType;
    if (data.damageType !== undefined) skill.damageType = data.damageType;
    if (data.damageFormula !== undefined)
      skill.damageFormula = data.damageFormula;
    if (data.healingFormula !== undefined)
      skill.healingFormula = data.healingFormula;

    return this.skillDefinitionRepository.save(skill);
  }

  // Admin: Delete skill definition (soft delete by setting inactive)
  async deleteSkillDefinition(skillId: string): Promise<void> {
    const skill = await this.skillDefinitionRepository.findOne({
      where: { skillId },
    });

    if (!skill) {
      throw new NotFoundException(
        `Skill definition with ID '${skillId}' not found`,
      );
    }

    // First, remove all player skills that use this skill definition
    await this.playerSkillRepository.delete({
      skillDefinitionId: skill.id,
    });

    console.log(
      `🗑️ Removed all player skills for skill definition: ${skillId}`,
    );

    // Then set the skill definition as inactive
    skill.isActive = false;
    await this.skillDefinitionRepository.save(skill);
  }

  // Admin: Hard delete skill definition (dangerous - removes from DB)
  async hardDeleteSkillDefinition(skillId: string): Promise<void> {
    const skill = await this.skillDefinitionRepository.findOne({
      where: { skillId },
    });

    if (!skill) {
      throw new NotFoundException(
        `Skill definition with ID '${skillId}' not found`,
      );
    }

    // First, remove all player skills that use this skill definition
    await this.playerSkillRepository.delete({
      skillDefinitionId: skill.id,
    });

    console.log(
      `🗑️ Hard deleted all player skills for skill definition: ${skillId}`,
    );

    // Then hard delete the skill definition
    const result = await this.skillDefinitionRepository.delete({ skillId });

    if (result.affected === 0) {
      throw new NotFoundException(
        `Skill definition with ID '${skillId}' not found`,
      );
    }
  }

  // Get skill definitions for a specific user level and attribute
  async getAvailableSkillsForUser(
    userLevel: number,
    userAttributeValue: number,
    attributeType: 'STR' | 'INT' | 'DEX' | 'VIT' | 'LUK',
  ): Promise<SkillDefinitionData[]> {
    const skills = await this.skillDefinitionRepository.find({
      where: { isActive: true, requiredAttribute: attributeType },
      order: { sortOrder: 'ASC', skillId: 'ASC' },
    });

    return skills
      .filter((skill) => skill.canBeUnlocked(userLevel, userAttributeValue))
      .map((skill) => skill.toSkillDefinition());
  }

  // Validate skill definition data
  validateSkillDefinition(data: Partial<SkillDefinitionData>): string[] {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (!data.description || data.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (
      !data.requiredAttribute ||
      !['STR', 'INT', 'DEX', 'VIT', 'LUK'].includes(data.requiredAttribute)
    ) {
      errors.push(
        'Valid required attribute is required (STR, INT, DEX, VIT, LUK)',
      );
    }

    if (!data.effects || Object.keys(data.effects).length === 0) {
      errors.push('Effects are required');
    }

    if (data.maxLevel && (data.maxLevel < 1 || data.maxLevel > 10)) {
      errors.push('Max level must be between 1 and 10');
    }

    return errors;
  }

  // Get skill definition entity by skillId (returns the actual entity, not data)
  async getSkillDefinitionEntity(
    skillId: string,
  ): Promise<SkillDefinition | null> {
    return this.skillDefinitionRepository.findOne({
      where: { skillId, isActive: true },
    });
  }
}
