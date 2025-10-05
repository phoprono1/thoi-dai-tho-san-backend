export enum AbilityType {
  ATTACK = 'attack',
  HEAL = 'heal',
  BUFF = 'buff',
  DEBUFF = 'debuff',
  UTILITY = 'utility',
}

export enum TargetType {
  ENEMY = 'enemy',
  ALLY = 'ally',
  SELF = 'self',
  ALL_ENEMIES = 'all_enemies',
  ALL_ALLIES = 'all_allies',
}

export interface AbilityEffects {
  // Attack effects
  damageType?: 'physical' | 'magic' | 'true';
  damageMultiplier?: number;
  scaling?: {
    strength?: number;
    intelligence?: number;
    dexterity?: number;
  };

  // Heal effects
  healAmount?: number;
  healPercentage?: number; // % of max HP

  // Buff/Debuff effects
  statBonus?: {
    attack?: number;
    defense?: number;
    critRate?: number;
    [key: string]: number | undefined;
  };
  duration?: number; // Turns

  // Additional effects
  additionalEffects?: Array<{
    type: 'burn' | 'poison' | 'stun' | 'shield' | 'fear';
    duration?: number;
    value?: number;
  }>;
}
