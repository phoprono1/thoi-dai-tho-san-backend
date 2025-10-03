/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { CombatActorInput, CombatLogEntry, SkillData } from './types';
import { evaluate } from 'mathjs';

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
    // Check mana cost - active skills default to 10 if not specified
    const manaCost = skill.skillType === 'active' ? (skill.manaCost ?? 10) : 0;
    const currentMana = caster.stats.currentMana ?? caster.stats.maxMana;

    console.log(`🔷 [MANA DEBUG] ${caster.name} using skill "${skill.name}":`);
    console.log(`   🆔 Received caster._debugId = ${(caster as any)._debugId}`);
    console.log(`   📍 caster.stats object reference: ${typeof caster.stats}`);
    console.log(`   - Skill Type: ${skill.skillType}`);
    console.log(`   - Skill manaCost field: ${skill.manaCost}`);
    console.log(`   - Calculated manaCost: ${manaCost}`);
    console.log(`   - Current Mana: ${currentMana}`);
    console.log(`   - Max Mana: ${caster.stats.maxMana}`);

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
    const newMana = currentMana - manaCost;
    caster.stats.currentMana = newMana;

    console.log(
      `   ✅ Mana consumed! ${currentMana} → ${newMana} (-${manaCost})`,
    );
    console.log(
      `   📊 After mutation: caster.stats.currentMana = ${caster.stats.currentMana}`,
    );

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
      // Check if skill has damage (from effect or damageFormula)
      if (effect.damage || skill.damageFormula) {
        // Damage skill - use effect.damage as base, or 0 if only formula exists
        const baseDamage = effect.damage || 0;
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
          manaBefore: currentMana, // ✅ NEW: Track mana changes
          manaAfter: caster.stats.currentMana,
          manaCost: manaCost,
          description: `${caster.name} sử dụng ${skill.name} gây ${damage} sát thương ${skill.damageType || 'physical'} lên ${target.name}`,
        } as CombatLogEntry;
        logs.push(logEntry);
      } else if (effect.healing || skill.healingFormula) {
        // Healing skill - use effect.healing as base, or 0 if only formula exists
        const baseHealing = effect.healing || 0;
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
          manaBefore: currentMana, // ✅ NEW: Track mana changes
          manaAfter: caster.stats.currentMana,
          manaCost: manaCost,
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
      // Use mathjs for safe formula evaluation
      // Provide all common attributes for formula flexibility
      const scope = {
        INT: caster.metadata?.totalIntelligence || caster.stats.attack, // Prefer totalIntelligence from metadata
        STR: caster.metadata?.totalStrength || 10,
        DEX: caster.metadata?.totalDexterity || 10,
        VIT: caster.metadata?.totalVitality || 10,
        LUK: caster.metadata?.totalLuck || 10,
        attack: caster.stats.attack,
        level: skill.level,
      };
      damage = evaluate(skill.damageFormula, scope) as number;
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
      // Use mathjs for safe formula evaluation
      // Provide all common attributes for formula flexibility
      const scope = {
        INT: caster.metadata?.totalIntelligence || caster.stats.attack,
        STR: caster.metadata?.totalStrength || 10,
        DEX: caster.metadata?.totalDexterity || 10,
        VIT: caster.metadata?.totalVitality || 10,
        LUK: caster.metadata?.totalLuck || 10,
        attack: caster.stats.attack,
        level: skill.level,
      };
      healing = evaluate(skill.healingFormula, scope) as number;
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
