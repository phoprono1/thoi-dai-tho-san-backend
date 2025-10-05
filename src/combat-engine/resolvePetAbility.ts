import { CombatActorInput } from './types';
import { createRng } from './prng';

type PRNG = ReturnType<typeof createRng>;

export interface PetAbility {
  id: number;
  name: string;
  type: 'attack' | 'heal' | 'buff' | 'debuff' | 'utility';
  effects: {
    damageType?: 'physical' | 'magic' | 'true';
    damageMultiplier?: number;
    scaling?: { strength?: number; intelligence?: number; dexterity?: number };
    healAmount?: number;
    healPercentage?: number;
    statBonus?: {
      attack?: number;
      defense?: number;
      critRate?: number;
      maxHp?: number;
    };
    duration?: number;
    additionalEffects?: Array<{
      type: 'burn' | 'poison' | 'stun' | 'shield' | 'fear';
      duration?: number;
      value?: number;
    }>;
  };
  cooldown: number;
  manaCost: number;
  targetType: 'enemy' | 'ally' | 'self' | 'all_enemies' | 'all_allies';
  icon?: string;
}

export interface PetAbilityContext {
  rng: PRNG;
  turn: number;
  actionOrderStart: number;
  allPlayers: CombatActorInput[];
  allEnemies: CombatActorInput[];
  petStats?: {
    strength: number;
    intelligence: number;
    dexterity: number;
  };
}

export interface PetAbilityResult {
  logs: any[];
}

/**
 * Execute a pet ability in combat
 */
export function resolvePetAbility(
  pet: { name: string; id: number },
  ability: PetAbility,
  owner: CombatActorInput,
  context: PetAbilityContext,
): PetAbilityResult {
  const { rng, turn, actionOrderStart, allPlayers, allEnemies, petStats } =
    context;
  const logs: any[] = [];
  const actionOrder = actionOrderStart;

  // Get targets based on ability targetType
  let targets: CombatActorInput[] = [];

  switch (ability.targetType) {
    case 'enemy':
      targets = allEnemies.filter((e) => (e.currentHp ?? 0) > 0);
      if (targets.length > 0) {
        targets = [targets[Math.floor(rng.next() * targets.length)]];
      }
      break;
    case 'all_enemies':
      targets = allEnemies.filter((e) => (e.currentHp ?? 0) > 0);
      break;
    case 'ally':
      targets = allPlayers.filter((p) => (p.currentHp ?? 0) > 0);
      if (targets.length > 0) {
        // Target the player with lowest HP%
        targets = [
          targets.reduce((lowest, p) => {
            const currentHpPercent = (p.currentHp ?? 0) / p.stats.maxHp;
            const lowestHpPercent =
              (lowest.currentHp ?? 0) / lowest.stats.maxHp;
            return currentHpPercent < lowestHpPercent ? p : lowest;
          }),
        ];
      }
      break;
    case 'all_allies':
      targets = allPlayers.filter((p) => (p.currentHp ?? 0) > 0);
      break;
    case 'self':
      targets = [owner];
      break;
  }

  if (targets.length === 0) {
    logs.push({
      turn,
      actionOrder,
      actorType: 'pet',
      actorId: pet.id,
      actorName: pet.name,
      action: 'ability_failed',
      abilityName: ability.name,
      message: `${pet.name} tried to use ${ability.name} but found no valid targets`,
    });
    return { logs };
  }

  // Execute ability based on type
  switch (ability.type) {
    case 'attack':
      executeAttackAbility(
        pet,
        ability,
        owner,
        targets,
        petStats,
        rng,
        turn,
        actionOrder,
        logs,
      );
      break;
    case 'heal':
      executeHealAbility(pet, ability, targets, turn, actionOrder, logs);
      break;
    case 'buff':
      executeBuffAbility(pet, ability, targets, turn, actionOrder, logs);
      break;
    case 'debuff':
      executeDebuffAbility(pet, ability, targets, turn, actionOrder, logs);
      break;
    case 'utility':
      executeUtilityAbility(pet, ability, targets, turn, actionOrder, logs);
      break;
  }

  return { logs };
}

function executeAttackAbility(
  pet: { name: string; id: number },
  ability: PetAbility,
  owner: CombatActorInput,
  targets: CombatActorInput[],
  petStats:
    | { strength: number; intelligence: number; dexterity: number }
    | undefined,
  rng: PRNG,
  turn: number,
  actionOrder: number,
  logs: any[],
): void {
  const effects = ability.effects;
  const damageType = effects.damageType || 'physical';
  const baseMultiplier = effects.damageMultiplier || 1.0;

  // Calculate scaling from pet stats
  let scalingBonus = 0;
  if (petStats && effects.scaling) {
    if (effects.scaling.strength) {
      scalingBonus += petStats.strength * effects.scaling.strength;
    }
    if (effects.scaling.intelligence) {
      scalingBonus += petStats.intelligence * effects.scaling.intelligence;
    }
    if (effects.scaling.dexterity) {
      scalingBonus += petStats.dexterity * effects.scaling.dexterity;
    }
  }

  targets.forEach((target) => {
    // Base damage from owner's attack + pet scaling
    const ownerAttack = owner.stats.attack || 10;
    const baseDamage = ownerAttack * baseMultiplier + scalingBonus;

    // Apply target defense (simplified)
    const targetDefense = target.stats.defense || 0;
    const damageReduction = Math.max(
      0,
      1 - targetDefense / (targetDefense + 100),
    );
    let finalDamage = Math.floor(baseDamage * damageReduction);

    // True damage bypasses defense
    if (damageType === 'true') {
      finalDamage = Math.floor(baseDamage);
    }

    // Random variance ±10%
    const variance = 1 + (rng.next() - 0.5) * 0.2;
    finalDamage = Math.floor(finalDamage * variance);

    // Apply damage
    const oldHp = target.currentHp ?? 0;
    target.currentHp = Math.max(0, (target.currentHp ?? 0) - finalDamage);

    logs.push({
      turn,
      actionOrder,
      actorType: 'pet',
      actorId: pet.id,
      actorName: pet.name,
      targetType: target.isPlayer ? 'player' : 'enemy',
      targetId: target.id,
      targetName: target.name,
      action: 'pet_ability',
      abilityName: ability.name,
      abilityType: ability.type,
      damageType,
      damage: finalDamage,
      targetHpBefore: oldHp,
      targetHpAfter: target.currentHp,
      message: `${pet.name} used ${ability.name}! Dealt ${finalDamage} ${damageType} damage to ${target.name}`,
      icon: ability.icon,
    });

    // Apply additional effects (poison, burn, etc.)
    if (effects.additionalEffects) {
      effects.additionalEffects.forEach((effect) => {
        logs.push({
          turn,
          actionOrder: actionOrder + 0.1,
          actorType: 'pet',
          actorName: pet.name,
          targetType: target.isPlayer ? 'player' : 'enemy',
          targetName: target.name,
          action: 'status_effect',
          effectType: effect.type,
          duration: effect.duration,
          value: effect.value,
          message: `${target.name} is affected by ${effect.type}!`,
        });
      });
    }
  });
}

function executeHealAbility(
  pet: { name: string; id: number },
  ability: PetAbility,
  targets: CombatActorInput[],
  turn: number,
  actionOrder: number,
  logs: any[],
): void {
  const effects = ability.effects;

  targets.forEach((target) => {
    let healAmount = effects.healAmount || 0;

    // Percentage-based healing
    if (effects.healPercentage) {
      healAmount += Math.floor(target.stats.maxHp * effects.healPercentage);
    }

    const oldHp = target.currentHp ?? 0;
    target.currentHp = Math.min(
      target.stats.maxHp,
      (target.currentHp ?? 0) + healAmount,
    );
    const actualHeal = target.currentHp - oldHp;

    logs.push({
      turn,
      actionOrder,
      actorType: 'pet',
      actorId: pet.id,
      actorName: pet.name,
      targetType: target.isPlayer ? 'player' : 'enemy',
      targetId: target.id,
      targetName: target.name,
      action: 'pet_ability',
      abilityName: ability.name,
      abilityType: ability.type,
      healing: actualHeal,
      targetHpBefore: oldHp,
      targetHpAfter: target.currentHp,
      message: `${pet.name} used ${ability.name}! Restored ${actualHeal} HP to ${target.name}`,
      icon: ability.icon,
    });
  });
}

function executeBuffAbility(
  pet: { name: string; id: number },
  ability: PetAbility,
  targets: CombatActorInput[],
  turn: number,
  actionOrder: number,
  logs: any[],
): void {
  const effects = ability.effects;
  const statBonus = effects.statBonus || {};
  const duration = effects.duration || 1;

  targets.forEach((target) => {
    // Apply stat bonuses (simplified - in full impl, track buffs with duration)
    if (statBonus.attack) {
      target.stats.attack = (target.stats.attack || 0) + statBonus.attack;
    }
    if (statBonus.defense) {
      target.stats.defense = (target.stats.defense || 0) + statBonus.defense;
    }
    if (statBonus.critRate) {
      target.stats.critRate = (target.stats.critRate || 0) + statBonus.critRate;
    }

    const buffList = Object.entries(statBonus)
      .map(([stat, value]) => `+${value} ${stat}`)
      .join(', ');

    logs.push({
      turn,
      actionOrder,
      actorType: 'pet',
      actorId: pet.id,
      actorName: pet.name,
      targetType: target.isPlayer ? 'player' : 'enemy',
      targetId: target.id,
      targetName: target.name,
      action: 'pet_ability',
      abilityName: ability.name,
      abilityType: ability.type,
      buff: statBonus,
      duration,
      message: `${pet.name} used ${ability.name}! ${target.name} gained ${buffList} for ${duration} turns`,
      icon: ability.icon,
    });
  });
}

function executeDebuffAbility(
  pet: { name: string; id: number },
  ability: PetAbility,
  targets: CombatActorInput[],
  turn: number,
  actionOrder: number,
  logs: any[],
): void {
  targets.forEach((target) => {
    logs.push({
      turn,
      actionOrder,
      actorType: 'pet',
      actorId: pet.id,
      actorName: pet.name,
      targetType: target.isPlayer ? 'player' : 'enemy',
      targetId: target.id,
      targetName: target.name,
      action: 'pet_ability',
      abilityName: ability.name,
      abilityType: ability.type,
      message: `${pet.name} used ${ability.name} on ${target.name}!`,
      icon: ability.icon,
    });
  });
}

function executeUtilityAbility(
  pet: { name: string; id: number },
  ability: PetAbility,
  targets: CombatActorInput[],
  turn: number,
  actionOrder: number,
  logs: any[],
): void {
  logs.push({
    turn,
    actionOrder,
    actorType: 'pet',
    actorId: pet.id,
    actorName: pet.name,
    action: 'pet_ability',
    abilityName: ability.name,
    abilityType: ability.type,
    message: `${pet.name} used ${ability.name}!`,
    icon: ability.icon,
  });
}
