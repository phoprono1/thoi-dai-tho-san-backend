/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerSkill } from './player-skill.entity';
import { SkillDefinitionService } from './skill-definition.service';
import { UserStatsService } from '../user-stats/user-stats.service';

@Injectable()
export class SkillService {
  constructor(
    @InjectRepository(PlayerSkill)
    private playerSkillRepository: Repository<PlayerSkill>,
    private skillDefinitionService: SkillDefinitionService,
    private userStatsService: UserStatsService,
  ) {}

  // Get all player skills for a user
  async getPlayerSkills(userId: number): Promise<PlayerSkill[]> {
    return this.playerSkillRepository.find({
      where: { userId },
      relations: ['skillDefinition'],
      order: { unlockedAt: 'ASC' },
    });
  }

  // Get available skills for a user (skills they can unlock)
  async getAvailableSkills(userId: number) {
    console.log(`🔍 Checking available skills for user ${userId}`);

    // Get user stats to check requirements
    const userStats = await this.userStatsService.findByUserId(userId);
    if (!userStats) {
      console.log(`❌ User stats not found for user ${userId}`);
      throw new NotFoundException('User stats not found');
    }

    // Get user's current level and attributes
    const userLevel = userStats.user?.level || 1;
    const userAttributes =
      await this.userStatsService.getTotalStatsWithAllBonuses(userId);

    console.log(`📊 User level: ${userLevel}, attributes:`, userAttributes);

    // Get all unlocked skill IDs
    const playerSkills = await this.getPlayerSkills(userId);
    const unlockedSkillIds = new Set(
      playerSkills.map((s) => s.skillDefinition.skillId),
    );

    console.log(`🔓 Unlocked skills:`, Array.from(unlockedSkillIds));

    // Get all skill definitions
    const allSkills =
      await this.skillDefinitionService.getAllSkillDefinitions();

    console.log(`📚 Total skill definitions: ${allSkills.length}`);

    // Filter skills that user can unlock
    const availableSkills = allSkills
      .filter((skill) => {
        // Not already unlocked
        if (unlockedSkillIds.has(skill.id)) {
          console.log(`❌ Skill ${skill.id} already unlocked`);
          return false;
        }

        // Check requirements
        if (skill.requiredLevel > userLevel) {
          console.log(
            `❌ Skill ${skill.id} requires level ${skill.requiredLevel}, user has ${userLevel}`,
          );
          return false;
        }

        const userAttrValue =
          userAttributes[skill.requiredAttribute.toLowerCase()] || 0;
        if (skill.requiredAttributeValue > userAttrValue) {
          console.log(
            `❌ Skill ${skill.id} requires ${skill.requiredAttribute} ${skill.requiredAttributeValue}, user has ${userAttrValue}`,
          );
          return false;
        }

        console.log(`✅ Skill ${skill.id} is available`);
        return true;
      })
      .map((skill) => ({
        ...skill,
        canUnlock: true,
      }));

    console.log(`🎯 Available skills: ${availableSkills.length}`);
    return availableSkills;
  }

  // Unlock a skill for a user
  async unlockSkill(userId: number, skillId: string): Promise<PlayerSkill> {
    // Check if skill exists
    const skillDefinition =
      await this.skillDefinitionService.getSkillDefinitionById(skillId);
    if (!skillDefinition) {
      throw new NotFoundException(`Skill '${skillId}' not found`);
    }

    // Get the actual SkillDefinition entity to get the numeric ID
    const skillEntity =
      await this.skillDefinitionService.getSkillDefinitionEntity(skillId);
    if (!skillEntity) {
      throw new NotFoundException(`Skill entity '${skillId}' not found`);
    }

    // Check if user already has this skill
    const existingSkill = await this.playerSkillRepository.findOne({
      where: { userId, skillDefinitionId: skillEntity.id },
    });

    if (existingSkill) {
      throw new BadRequestException(`Skill '${skillId}' is already unlocked`);
    }

    // Check requirements
    const userStats = await this.userStatsService.findByUserId(userId);
    if (!userStats) {
      throw new NotFoundException('User stats not found');
    }

    const userLevel = userStats.user?.level || 1;
    const userAttributes =
      await this.userStatsService.getTotalStatsWithAllBonuses(userId);
    const userAttrValue =
      userAttributes[skillDefinition.requiredAttribute.toLowerCase()] || 0;

    if (skillDefinition.requiredLevel > userLevel) {
      throw new BadRequestException(
        `User level ${userLevel} is too low. Required: ${skillDefinition.requiredLevel}`,
      );
    }

    if (skillDefinition.requiredAttributeValue > userAttrValue) {
      throw new BadRequestException(
        `Attribute ${skillDefinition.requiredAttribute} value ${userAttrValue} is too low. Required: ${skillDefinition.requiredAttributeValue}`,
      );
    }

    // Create player skill
    const playerSkill = this.playerSkillRepository.create({
      userId,
      skillDefinitionId: skillEntity.id,
      level: 1,
    });

    return this.playerSkillRepository.save(playerSkill);
  }

  // Level up a skill for a user
  async levelUpSkill(userId: number, skillId: string): Promise<PlayerSkill> {
    // Find the player skill
    const playerSkill = await this.playerSkillRepository.findOne({
      where: { userId, skillDefinition: { skillId } },
      relations: ['skillDefinition'],
    });

    if (!playerSkill) {
      throw new NotFoundException(`Skill '${skillId}' not found for user`);
    }

    // Check if can level up
    if (playerSkill.level >= playerSkill.skillDefinition.maxLevel) {
      throw new BadRequestException(
        `Skill '${skillId}' is already at maximum level (${playerSkill.skillDefinition.maxLevel})`,
      );
    }

    // Level up
    playerSkill.level += 1;
    return this.playerSkillRepository.save(playerSkill);
  }

  // Get player skill effects (for combat calculations)
  async getPlayerSkillEffects(userId: number) {
    const playerSkills = await this.getPlayerSkills(userId);

    const statBonuses = {
      attack: 0,
      defense: 0,
      maxHp: 0,
      critRate: 0,
      critDamage: 0,
      dodgeRate: 0,
      accuracy: 0,
      lifesteal: 0,
      armorPen: 0,
      comboRate: 0,
    };

    const specialEffects: string[] = [];

    // Calculate total effects from all skills
    for (const playerSkill of playerSkills) {
      const effects = playerSkill.getCurrentEffects();
      if (effects) {
        // Add stat bonuses
        if (effects.statBonuses) {
          for (const [stat, value] of Object.entries(effects.statBonuses)) {
            if (typeof value === 'number') {
              statBonuses[stat] += value;
            }
          }
        }

        // Add special effects
        if (effects.specialEffects) {
          specialEffects.push(...effects.specialEffects);
        }
      }
    }

    return {
      statBonuses,
      specialEffects,
    };
  }

  // Get skill definition by ID (for backward compatibility)
  async getSkillDefinition(skillId: string) {
    return this.skillDefinitionService.getSkillDefinitionById(skillId);
  }
}
