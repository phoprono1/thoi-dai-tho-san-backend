/**
 * Admin Helper Functions for Character Class Management
 * These are utility functions to help admin manage classes more easily
 */

import { ClassType, ClassTier } from './character-class.entity';

/**
 * Generate template for new class creation
 */
export function generateClassTemplate(type: ClassType, tier: ClassTier) {
  const baseBonus = tier * 2;

  return {
    name: `New ${type} Class Tier ${tier}`,
    description: `A tier ${tier} ${type} class - customize as needed`,
    type,
    tier,
    requiredLevel: getDefaultLevelForTier(tier),
    statBonuses: {
      strength: baseBonus,
      intelligence: baseBonus,
      dexterity: baseBonus,
      vitality: baseBonus,
      luck: baseBonus,
    },
    skillUnlocks: [],
    advancementRequirements:
      tier > 1
        ? {
            dungeons: [],
            quests: [],
            items: [],
            stats: {
              minTotalStats: tier * 50, // Suggestion - admin can change
            },
          }
        : null,
    metadata: {
      displayName: `${type.charAt(0).toUpperCase() + type.slice(1)} Tier ${tier}`,
      description: `Customize this ${type} class description`,
      playstyle: 'Admin-defined',
      difficulty: 'Medium',
      tags: [type, `tier-${tier}`],
      notes: 'Created from template - customize as needed',
    },
  };
}

/**
 * Get default level requirements for tiers (admin can override)
 */
function getDefaultLevelForTier(tier: ClassTier): number {
  const defaults = {
    [ClassTier.BASIC]: 1,
    [ClassTier.AWAKENED]: 10,
    [ClassTier.ADVANCED]: 25,
    [ClassTier.EXPERT]: 50,
    [ClassTier.MASTER]: 75,
    [ClassTier.GRANDMASTER]: 100,
    [ClassTier.LEGENDARY]: 125,
    [ClassTier.MYTHIC]: 150,
    [ClassTier.TRANSCENDENT]: 175,
    [ClassTier.GODLIKE]: 200,
  };
  return defaults[tier] || 1;
}

/**
 * Validate class configuration
 */
export function validateClassConfig(classData: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!classData.name || classData.name.trim().length === 0) {
    errors.push('Class name is required');
  }

  if (!classData.type || !Object.values(ClassType).includes(classData.type)) {
    errors.push('Valid class type is required');
  }

  if (!classData.tier || classData.tier < 1 || classData.tier > 10) {
    errors.push('Tier must be between 1 and 10');
  }

  if (!classData.requiredLevel || classData.requiredLevel < 1) {
    errors.push('Required level must be at least 1');
  }

  if (!classData.statBonuses || typeof classData.statBonuses !== 'object') {
    errors.push('Stat bonuses must be provided');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate advancement mapping template
 */
export function generateAdvancementTemplate(
  fromClassId: number,
  toClassId: number,
) {
  return {
    fromClassId,
    toClassId,
    levelRequired: 10, // Default - admin can change
    weight: 100, // Default weight for random selection
    allowPlayerChoice: false, // Default - admin can enable
    isAwakening: false, // Admin can set for tier 1->2 transitions
    requirements: {
      // Admin can add custom requirements
      stats: {},
      achievements: [],
      items: [],
      dungeons: [],
      quests: [],
    },
  };
}

/**
 * Suggest stat distributions based on class type (admin can ignore)
 */
export function suggestStatDistribution(type: ClassType, tier: ClassTier) {
  const baseBonus = tier * 2;
  const suggestions: Record<ClassType, Record<string, number>> = {
    [ClassType.WARRIOR]: {
      strength: baseBonus * 1.5,
      vitality: baseBonus * 1.2,
      dexterity: baseBonus * 0.8,
      intelligence: baseBonus * 0.5,
      luck: baseBonus * 0.8,
    },
    [ClassType.MAGE]: {
      intelligence: baseBonus * 1.5,
      luck: baseBonus * 1.2,
      vitality: baseBonus * 0.8,
      strength: baseBonus * 0.5,
      dexterity: baseBonus * 0.8,
    },
    [ClassType.ARCHER]: {
      dexterity: baseBonus * 1.5,
      luck: baseBonus * 1.2,
      strength: baseBonus * 0.8,
      intelligence: baseBonus * 0.8,
      vitality: baseBonus * 0.8,
    },
    [ClassType.ASSASSIN]: {
      dexterity: baseBonus * 1.5,
      luck: baseBonus * 1.3,
      strength: baseBonus * 0.9,
      intelligence: baseBonus * 0.7,
      vitality: baseBonus * 0.6,
    },
    [ClassType.PRIEST]: {
      intelligence: baseBonus * 1.3,
      vitality: baseBonus * 1.2,
      luck: baseBonus * 1.0,
      strength: baseBonus * 0.6,
      dexterity: baseBonus * 0.7,
    },
    [ClassType.KNIGHT]: {
      strength: baseBonus * 1.3,
      vitality: baseBonus * 1.4,
      dexterity: baseBonus * 0.8,
      intelligence: baseBonus * 0.7,
      luck: baseBonus * 0.8,
    },
    [ClassType.TANK]: {
      vitality: baseBonus * 1.6,
      strength: baseBonus * 1.2,
      dexterity: baseBonus * 0.7,
      intelligence: baseBonus * 0.6,
      luck: baseBonus * 0.7,
    },
    [ClassType.HEALER]: {
      intelligence: baseBonus * 1.4,
      vitality: baseBonus * 1.3,
      luck: baseBonus * 1.0,
      strength: baseBonus * 0.5,
      dexterity: baseBonus * 0.6,
    },
    [ClassType.SUMMONER]: {
      intelligence: baseBonus * 1.4,
      luck: baseBonus * 1.3,
      vitality: baseBonus * 0.9,
      dexterity: baseBonus * 0.8,
      strength: baseBonus * 0.6,
    },
    [ClassType.NECROMANCER]: {
      intelligence: baseBonus * 1.5,
      vitality: baseBonus * 1.1,
      luck: baseBonus * 1.0,
      strength: baseBonus * 0.6,
      dexterity: baseBonus * 0.8,
    },
  };

  return (
    suggestions[type] || {
      strength: baseBonus,
      intelligence: baseBonus,
      dexterity: baseBonus,
      vitality: baseBonus,
      luck: baseBonus,
    }
  );
}

/**
 * Generate requirement suggestions based on tier
 */
export function suggestRequirements(tier: ClassTier) {
  if (tier <= ClassTier.AWAKENED) {
    return null; // No requirements for basic tiers
  }

  return {
    stats: {
      minTotalStats: tier * 50,
      // Admin can add specific stat requirements
    },
    // Admin can add other requirements as needed
    dungeons: [],
    quests: [],
    items: [],
    achievements: [],
    pvpRank: null,
    guildLevel: null,
    playtime: null,
  };
}
