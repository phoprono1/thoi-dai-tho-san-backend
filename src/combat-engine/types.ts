export type Percent = number;

export interface CombatStats {
  maxHp: number;
  attack: number;
  defense: number;
  critRate: Percent; // percent like 25 means 25%
  critDamage: Percent; // percent like 150 means 150%
  lifesteal: Percent;
  armorPen: Percent;
  dodgeRate: Percent;
  accuracy: Percent;
  comboRate: Percent;
  counterRate: Percent;
  maxMana: number;
  currentMana: number;
  // optional
  speed?: number;
}

export interface SkillCondition {
  type:
    | 'player_hp_below'
    | 'enemy_hp_below'
    | 'enemy_count'
    | 'turn_count'
    | 'mana_above'
    | 'always';
  value?: number; // percentage for hp conditions, count for enemy/turn conditions
  target?: 'any_enemy' | 'lowest_hp_enemy'; // for enemy_hp_below condition
}

export interface SkillData {
  id: string;
  name: string;
  skillType: 'passive' | 'active' | 'toggle';
  manaCost?: number;
  cooldown?: number;
  targetType?: 'self' | 'enemy' | 'ally' | 'aoe_enemies' | 'aoe_allies';
  damageType?: 'physical' | 'magical';
  damageFormula?: string;
  healingFormula?: string;
  conditions?: SkillCondition[]; // Conditions that must be met to use this skill
  effects: {
    [level: number]: {
      damage?: number;
      healing?: number;
      buffDuration?: number;
      debuffDuration?: number;
      statBonuses?: any;
      specialEffects?: string[];
    };
  };
  level: number;
}

export interface CombatActorInput {
  id: number | string;
  name: string;
  isPlayer: boolean;
  stats: CombatStats;
  currentHp?: number;
  maxHp?: number;
  skills?: SkillData[];
  skillCooldowns?: Record<string, number>; // skillId -> remaining cooldown turns
  metadata?: any;
}

export interface CombatLogEntry {
  turn: number;
  actionOrder: number;
  actorId: number | string;
  actorName: string;
  actorIsPlayer: boolean;
  targetId: number | string;
  targetName: string;
  targetIsPlayer: boolean;
  type: 'attack' | 'miss' | 'counter' | 'combo' | 'skill' | 'other';
  skillId?: string;
  skillName?: string;
  damage?: number;
  healing?: number;
  hpBefore: number;
  hpAfter: number;
  flags?: {
    crit?: boolean;
    lifesteal?: number;
    armorPen?: number;
    dodge?: boolean;
    counter?: boolean;
    comboIndex?: number;
  };
  description?: string;
  rng?: any;
}

export interface CombatRunParams {
  players: CombatActorInput[];
  enemies: CombatActorInput[];
  maxTurns?: number;
  seed?: number | string;
}

export interface CombatRunResult {
  result: 'victory' | 'defeat';
  turns: number;
  logs: CombatLogEntry[];
  finalPlayers: CombatActorInput[];
  finalEnemies: CombatActorInput[];
  seedUsed?: number | string;
}
