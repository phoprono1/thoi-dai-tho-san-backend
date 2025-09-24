import { CombatActorInput, CombatLogEntry, SkillData } from './types';

export interface ResolveSkillOptions {
  rng: { next: () => number; seed?: number | string };
  turn: number;
  actionOrderStart: number;
  allPlayers: CombatActorInput[];
  allEnemies: CombatActorInput[];
}

export function resolveSkill(
  caster: CombatActorInput,
  skill: SkillData,
  target: CombatActorInput,
  options: ResolveSkillOptions,
): { logs: CombatLogEntry[]; actionOrderEnd: number } {
  const logs: CombatLogEntry[] = [];
  let actionOrder = options.actionOrderStart;
  const rng = options.rng;

  try {
    // Check mana cost
    const manaCost = skill.manaCost || 0;
    const currentMana = caster.stats.currentMana ?? caster.stats.maxMana;
    if (currentMana < manaCost) {
      // Not enough mana - this shouldn't happen if properly validated, but log it
      logs.push({
        turn: options.turn,
        actionOrder: actionOrder++,
        actorId: caster.id,
        actorName: caster.name,
        actorIsPlayer: caster.isPlayer,
        targetId: caster.id,
        targetName: caster.name,
        targetIsPlayer: caster.isPlayer,
        type: 'other',
        hpBefore: caster.currentHp ?? caster.stats.maxHp,
        hpAfter: caster.currentHp ?? caster.stats.maxHp,
        description: `${caster.name} không đủ mana để sử dụng ${skill.name}`,
      } as CombatLogEntry);
      return { logs, actionOrderEnd: actionOrder };
    }

    // Consume mana
    caster.stats.currentMana = currentMana - manaCost;

    const effect = skill.effects[skill.level] || skill.effects[1];
    if (!effect) {
      logs.push({
        turn: options.turn,
        actionOrder: actionOrder++,
        actorId: caster.id,
        actorName: caster.name,
        actorIsPlayer: caster.isPlayer,
        targetId: target.id,
        targetName: target.name,
        targetIsPlayer: target.isPlayer,
        type: 'skill',
        skillId: skill.id,
        skillName: skill.name,
        hpBefore: target.currentHp ?? target.stats.maxHp,
        hpAfter: target.currentHp ?? target.stats.maxHp,
        description: `${caster.name} sử dụng ${skill.name} nhưng không có hiệu ứng`,
      } as CombatLogEntry);
      return { logs, actionOrderEnd: actionOrder };
    }

    // Handle different skill types
    if (skill.skillType === 'active') {
      if (effect.damage) {
        // Damage skill
        const baseDamage = effect.damage;
        const damage = calculateSkillDamage(
          skill,
          caster,
          target,
          baseDamage,
          rng,
        );

        const hpBefore = target.currentHp ?? target.stats.maxHp;
        const hpAfter = Math.max(0, hpBefore - damage);
        target.currentHp = hpAfter;

        const logEntry = {
          turn: options.turn,
          actionOrder: actionOrder++,
          actorId: caster.id,
          actorName: caster.name,
          actorIsPlayer: caster.isPlayer,
          targetId: target.id,
          targetName: target.name,
          targetIsPlayer: target.isPlayer,
          type: 'skill',
          skillId: skill.id,
          skillName: skill.name,
          damage,
          hpBefore,
          hpAfter,
          description: `${caster.name} sử dụng ${skill.name} gây ${damage} sát thương ${skill.damageType || 'physical'} lên ${target.name}`,
        } as CombatLogEntry;
        logs.push(logEntry);
      } else if (effect.healing) {
        // Healing skill
        const baseHealing = effect.healing;
        const healing = calculateSkillHealing(
          skill,
          caster,
          target,
          baseHealing,
          rng,
        );

        const hpBefore = target.currentHp ?? target.stats.maxHp;
        const hpAfter = Math.min(target.stats.maxHp, hpBefore + healing);
        target.currentHp = hpAfter;

        logs.push({
          turn: options.turn,
          actionOrder: actionOrder++,
          actorId: caster.id,
          actorName: caster.name,
          actorIsPlayer: caster.isPlayer,
          targetId: target.id,
          targetName: target.name,
          targetIsPlayer: target.isPlayer,
          type: 'skill',
          skillId: skill.id,
          skillName: skill.name,
          healing,
          hpBefore,
          hpAfter,
          description: `${caster.name} sử dụng ${skill.name} hồi ${healing} HP cho ${target.name}`,
        } as CombatLogEntry);
      } else if (effect.debuffDuration) {
        // Debuff skill (like Taunt)
        logs.push({
          turn: options.turn,
          actionOrder: actionOrder++,
          actorId: caster.id,
          actorName: caster.name,
          actorIsPlayer: caster.isPlayer,
          targetId: target.id,
          targetName: target.name,
          targetIsPlayer: target.isPlayer,
          type: 'skill',
          skillId: skill.id,
          skillName: skill.name,
          hpBefore: target.currentHp ?? target.stats.maxHp,
          hpAfter: target.currentHp ?? target.stats.maxHp,
          description: `${caster.name} sử dụng ${skill.name} lên ${target.name} (${effect.debuffDuration} lượt)`,
        } as CombatLogEntry);

        // TODO: Implement debuff tracking system
      }
    }
  } catch (error) {
    logs.push({
      turn: options.turn,
      actionOrder: actionOrder++,
      actorId: caster.id,
      actorName: caster.name,
      actorIsPlayer: caster.isPlayer,
      targetId: target.id,
      targetName: target.name,
      targetIsPlayer: target.isPlayer,
      type: 'other',
      hpBefore: caster.currentHp ?? caster.stats.maxHp,
      hpAfter: caster.currentHp ?? caster.stats.maxHp,
      description: `Đã xảy ra lỗi khi thực hiện kỹ năng ${skill.name}: ${error instanceof Error ? error.message : String(error)}`,
    } as CombatLogEntry);
  }

  return { logs, actionOrderEnd: actionOrder };
}

function calculateSkillDamage(
  skill: SkillData,
  caster: CombatActorInput,
  target: CombatActorInput,
  baseDamage: number,
  rng: { next: () => number },
): number {
  let damage = baseDamage;

  // Apply damage formula if available
  if (skill.damageFormula) {
    try {
      // Simple formula evaluation - replace variables with actual values
      let formula = skill.damageFormula;
      formula = formula.replace(/INT/g, caster.stats.attack.toString()); // Using attack as INT proxy
      formula = formula.replace(/level/g, skill.level.toString());

      // Simple eval for basic arithmetic
      damage = eval(formula) as number;
    } catch (error) {
      console.warn(
        'Failed to evaluate damage formula:',
        skill.damageFormula,
        error,
      );
    }
  }

  // Apply damage type modifiers
  const damageType = skill.damageType || 'physical';
  if (damageType === 'magical') {
    // Magical damage ignores physical defense, maybe reduce by magical resistance if implemented
    damage = Math.max(1, damage);
  } else {
    // Physical damage reduced by defense
    const defense = target.stats.defense || 0;
    damage = Math.max(1, damage - Math.floor(defense * 0.5));
  }

  // Add some randomness
  const variance = Math.max(1, Math.floor(damage * 0.1));
  damage += Math.floor(rng.next() * (variance * 2 + 1)) - variance;

  return Math.max(1, damage);
}

function calculateSkillHealing(
  skill: SkillData,
  caster: CombatActorInput,
  target: CombatActorInput,
  baseHealing: number,
  rng: { next: () => number },
): number {
  let healing = baseHealing;

  // Apply healing formula if available
  if (skill.healingFormula) {
    try {
      let formula = skill.healingFormula;
      formula = formula.replace(/INT/g, caster.stats.attack.toString()); // Using attack as INT proxy
      formula = formula.replace(/level/g, skill.level.toString());

      healing = eval(formula) as number;
    } catch (error) {
      console.warn(
        'Failed to evaluate healing formula:',
        skill.healingFormula,
        error,
      );
    }
  }

  // Add some randomness
  const variance = Math.max(1, Math.floor(healing * 0.1));
  healing += Math.floor(rng.next() * (variance * 2 + 1)) - variance;

  return Math.max(1, healing);
}
