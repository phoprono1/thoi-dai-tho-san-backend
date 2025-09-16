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
  // optional
  speed?: number;
}

export interface CombatActorInput {
  id: number | string;
  name: string;
  isPlayer: boolean;
  stats: CombatStats;
  currentHp?: number;
  maxHp?: number;
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
  damage?: number;
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
