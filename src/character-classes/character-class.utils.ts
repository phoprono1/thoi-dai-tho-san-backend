import { ClassType, ClassTier } from './character-class.entity';

/**
 * Utility functions for Character Class System
 */

// Level requirements for each tier
export const TIER_LEVEL_REQUIREMENTS = {
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
} as const;

// Basic class type display names (admin can override these in class metadata)
export const DEFAULT_CLASS_NAMES = {
  [ClassType.WARRIOR]: 'Chiến binh',
  [ClassType.MAGE]: 'Pháp sư',
  [ClassType.ARCHER]: 'Cung thủ',
  [ClassType.ASSASSIN]: 'Sát thủ',
  [ClassType.PRIEST]: 'Tăng lữ',
  [ClassType.KNIGHT]: 'Hiệp sĩ',
  [ClassType.TANK]: 'Đấu sĩ',
  [ClassType.HEALER]: 'Thầy chữa',
  [ClassType.SUMMONER]: 'Triệu hồi sư',
  [ClassType.NECROMANCER]: 'Tử linh sư',
} as const;

// All class types are now supported directly - no legacy mapping needed

/**
 * Get the minimum level required for a tier
 */
export function getMinLevelForTier(tier: ClassTier): number {
  return TIER_LEVEL_REQUIREMENTS[tier] || 1;
}

/**
 * Get the next tier for advancement
 */
export function getNextTier(currentTier: ClassTier): ClassTier | null {
  if (currentTier >= ClassTier.GODLIKE) {
    return null;
  }
  return (currentTier + 1) as ClassTier;
}

/**
 * Check if a level qualifies for tier advancement
 */
export function canAdvanceToTier(
  currentLevel: number,
  targetTier: ClassTier,
): boolean {
  return currentLevel >= getMinLevelForTier(targetTier);
}

// Legacy mapping function removed - all class types are now supported directly

/**
 * Get default display name for a class type (admin can override in class metadata)
 */
export function getDefaultClassName(classType: ClassType): string {
  return DEFAULT_CLASS_NAMES[classType] || classType;
}

/**
 * Check if a class type is awakening eligible (tier 2)
 */
export function isAwakeningEligible(tier: ClassTier): boolean {
  return tier === ClassTier.AWAKENED;
}

/**
 * Check if advancement requires player choice
 */
export function requiresPlayerChoice(tier: ClassTier): boolean {
  return tier > ClassTier.AWAKENED;
}

/**
 * Generate default stat bonuses for a class (admin can customize these)
 * This is just a helper function - admin has full control over actual bonuses
 */
export function generateDefaultStatBonuses(tier: ClassTier) {
  const baseBonus = tier * 2; // Simple progression - admin can override

  return {
    strength: baseBonus,
    intelligence: baseBonus,
    dexterity: baseBonus,
    vitality: baseBonus,
    luck: baseBonus,
  };
}

/**
 * Validate advancement requirements
 */
export function validateAdvancementRequirements(
  requirements: any,
  userLevel: number,
  userStats: any,
  userAchievements: any[] = [],
  userPvpRank: any = null,
  userGuildLevel: number = 0,
  userPlaytime: number = 0,
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  // Check level requirement
  if (requirements.minLevel && userLevel < requirements.minLevel) {
    missing.push(`Level ${requirements.minLevel} required`);
  }

  // Check stat requirements
  if (requirements.stats) {
    Object.entries(requirements.stats).forEach(([stat, minValue]) => {
      if (userStats[stat] < minValue) {
        missing.push(`${stat}: ${minValue} required`);
      }
    });
  }

  // Check achievement requirements
  if (requirements.achievements) {
    requirements.achievements.forEach((reqAchievement: any) => {
      const hasAchievement = userAchievements.some(
        (ach) => ach.id === reqAchievement.achievementId,
      );
      if (!hasAchievement) {
        missing.push(
          `Achievement: ${reqAchievement.achievementName || reqAchievement.achievementId}`,
        );
      }
    });
  }

  // Check PvP rank requirements
  if (requirements.pvpRank) {
    if (
      !userPvpRank ||
      (requirements.pvpRank.minRank &&
        userPvpRank.rank < requirements.pvpRank.minRank) ||
      (requirements.pvpRank.minPoints &&
        userPvpRank.points < requirements.pvpRank.minPoints)
    ) {
      missing.push(
        `PvP Rank: ${requirements.pvpRank.minRank || requirements.pvpRank.minPoints} required`,
      );
    }
  }

  // Check guild level requirement
  if (requirements.guildLevel && userGuildLevel < requirements.guildLevel) {
    missing.push(`Guild Level ${requirements.guildLevel} required`);
  }

  // Check playtime requirement
  if (requirements.playtime && userPlaytime < requirements.playtime) {
    missing.push(`${requirements.playtime} minutes playtime required`);
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: ClassTier): string {
  const names = {
    [ClassTier.BASIC]: 'Cơ bản',
    [ClassTier.AWAKENED]: 'Thức tỉnh',
    [ClassTier.ADVANCED]: 'Tiến bộ',
    [ClassTier.EXPERT]: 'Chuyên gia',
    [ClassTier.MASTER]: 'Bậc thầy',
    [ClassTier.GRANDMASTER]: 'Đại sư',
    [ClassTier.LEGENDARY]: 'Huyền thoại',
    [ClassTier.MYTHIC]: 'Thần thoại',
    [ClassTier.TRANSCENDENT]: 'Siêu việt',
    [ClassTier.GODLIKE]: 'Thần thánh',
  };

  return names[tier] || `Tier ${tier}`;
}
