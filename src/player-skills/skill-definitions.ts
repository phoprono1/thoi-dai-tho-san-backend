export type SkillId =
  | 'power_strike'
  | 'guardian'
  | 'berserker'
  | 'arcane_power'
  | 'mana_shield'
  | 'spell_echo'
  | 'swift_strikes'
  | 'evasion'
  | 'combo_master'
  | 'toughness'
  | 'regeneration'
  | 'pain_tolerance'
  | 'fortune'
  | 'lucky_charm'
  | 'gamble';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  maxLevel: number;
  requiredAttribute: 'STR' | 'INT' | 'DEX' | 'VIT' | 'LUK';
  requiredAttributeValue: number;
  requiredLevel: number;
  skillPointCost: number;
  effects: {
    [level: number]: {
      statBonuses?: {
        attack?: number;
        defense?: number;
        maxHp?: number;
        critRate?: number;
        critDamage?: number;
        dodgeRate?: number;
        accuracy?: number;
        lifesteal?: number;
        armorPen?: number;
        comboRate?: number;
      };
      specialEffects?: string[];
    };
  };
}

// Skill definitions sẽ được implement sau
export const SKILL_DEFINITIONS: Record<SkillId, SkillDefinition> = {} as any;
