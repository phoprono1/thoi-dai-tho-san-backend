/* eslint-disable @typescript-eslint/no-unused-vars */
import { CombatActorInput, CombatLogEntry } from './types';

export interface ResolveOptions {
  rng: { next: () => number; seed?: number | string };
  turn: number;
  actionOrderStart: number;
  maxCombo?: number;
}

export function resolveAttack(
  attacker: CombatActorInput,
  defender: CombatActorInput,
  options: ResolveOptions,
): { logs: CombatLogEntry[]; damageTotal: number; actionOrderEnd: number } {
  const logs: CombatLogEntry[] = [];
  let actionOrder = options.actionOrderStart;
  const rng = options.rng;
  const maxCombo = options.maxCombo ?? 3;

  let comboIndex = 0;
  let damageTotal = 0;

  const doOne = () => {
    const hpBefore = defender.currentHp ?? defender.stats.maxHp;

    // (old hitChance logic removed) -- new bounded-delta hitChance applied below

    // hit chance
    // Use bounded delta between accuracy and dodge to avoid runaway hit/miss
    const BASE_HIT = 75;
    const MAX_DELTA = 50;
    const HIT_MIN = 5;
    const HIT_MAX = 95;
    const acc = attacker.stats.accuracy || 0;
    const dod = defender.stats.dodgeRate || 0;
    const delta = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, acc - dod));
    const hitChance = Math.max(HIT_MIN, Math.min(HIT_MAX, BASE_HIT + delta));
    const rHit = rng.next();
    if (rHit * 100 >= hitChance) {
      logs.push({
        turn: options.turn,
        actionOrder: actionOrder++,
        actorId: attacker.id,
        actorName: attacker.name,
        actorIsPlayer: attacker.isPlayer,
        targetId: defender.id,
        targetName: defender.name,
        targetIsPlayer: defender.isPlayer,
        type: 'miss',
        hpBefore,
        hpAfter: hpBefore,
        description: `${attacker.name} đánh trượt ${defender.name}`,
        flags: { dodge: true },
        rng: { hit: rHit },
      } as CombatLogEntry);
      return 0;
    }

    // === damage calculation ===
    // crit
    const rCrit = rng.next();
    const crit = rCrit * 100 < (attacker.stats.critRate || 0);

    const armorPen = Math.max(0, Math.min(90, attacker.stats.armorPen || 0));
    const effectiveDef = Math.max(
      0,
      Math.floor((defender.stats.defense || 0) * (1 - armorPen / 100)),
    );

    // Percentage-based defense reduction
    const defenseReduction = effectiveDef / (effectiveDef + 100);
    const rawBase = Math.max(
      1,
      Math.floor((attacker.stats.attack || 1) * (1 - defenseReduction)),
    );
    const variance = Math.max(1, Math.floor(rawBase * 0.1));
    const randAdd = Math.floor(rng.next() * (variance + 1));
    const damageBeforeCrit = rawBase + randAdd;
    const critMultiplier = crit ? (attacker.stats.critDamage || 100) / 100 : 1;
    const damage = Math.max(1, Math.floor(damageBeforeCrit * critMultiplier));

    const hpAfter = Math.max(0, hpBefore - damage);
    defender.currentHp = hpAfter;
    damageTotal += damage;

    const lifesteal = Math.floor(
      damage * ((attacker.stats.lifesteal || 0) / 100),
    );
    if (lifesteal > 0) {
      attacker.currentHp = Math.min(
        attacker.stats.maxHp,
        (attacker.currentHp ?? attacker.stats.maxHp) + lifesteal,
      );
      // log lifesteal as its own entry for UI clarity
      logs.push({
        turn: options.turn,
        actionOrder: actionOrder++,
        actorId: attacker.id,
        actorName: attacker.name,
        actorIsPlayer: attacker.isPlayer,
        targetId: attacker.id,
        targetName: attacker.name,
        targetIsPlayer: attacker.isPlayer,
        type: 'other',
        hpBefore: (attacker.currentHp ?? attacker.stats.maxHp) - lifesteal,
        hpAfter: attacker.currentHp ?? attacker.stats.maxHp,
        description: `${attacker.name} hồi ${lifesteal} HP nhờ hút máu`,
      } as CombatLogEntry);
    }

    // Only show mechanics that actually triggered
    const parts: string[] = [];
    if (crit) parts.push('bạo kích');
    // Note: combo will be added later when we know if it actually triggered
    const descFlags = parts.length > 0 ? ` (${parts.join(', ')})` : '';
    logs.push({
      turn: options.turn,
      actionOrder: actionOrder++,
      actorId: attacker.id,
      actorName: attacker.name,
      actorIsPlayer: attacker.isPlayer,
      targetId: defender.id,
      targetName: defender.name,
      targetIsPlayer: defender.isPlayer,
      type: 'attack',
      damage,
      hpBefore,
      hpAfter,
      description: `${attacker.name} tấn công ${defender.name}${descFlags} gây ${damage} sát thương`,
      flags: { crit, lifesteal },
      rng: { hit: rHit, crit: rCrit },
    } as CombatLogEntry);

    // counter
    const rCounter = rng.next();
    if (
      (defender.stats.counterRate || 0) > 0 &&
      rCounter * 100 < (defender.stats.counterRate || 0)
    ) {
      const counterDamage = Math.max(
        1,
        Math.floor((defender.stats.attack || 1) * 0.3),
      );
      const attackerHpBefore = attacker.currentHp ?? attacker.stats.maxHp;
      attacker.currentHp = Math.max(0, attackerHpBefore - counterDamage);
      logs.push({
        turn: options.turn,
        actionOrder: actionOrder++,
        actorId: defender.id,
        actorName: defender.name,
        actorIsPlayer: defender.isPlayer,
        targetId: attacker.id,
        targetName: attacker.name,
        targetIsPlayer: attacker.isPlayer,
        type: 'counter',
        damage: counterDamage,
        hpBefore: attackerHpBefore,
        hpAfter: attacker.currentHp ?? 0,
        description: `${defender.name} phản kích ${attacker.name} gây ${counterDamage} sát thương`,
        flags: { counter: true },
        rng: { counter: rCounter },
      } as CombatLogEntry);
    }

    return damage;
  };

  // initial hit
  doOne();

  // combos
  while (
    comboIndex < maxCombo &&
    (attacker.stats.comboRate || 0) > 0 &&
    rng.next() * 100 < (attacker.stats.comboRate || 0) &&
    (defender.currentHp ?? defender.stats.maxHp) > 0
  ) {
    comboIndex++;
    const dmg = doOne();

    // Update the last log entry to indicate it's a combo hit
    const lastLog = logs[logs.length - 1];
    if (lastLog && lastLog.type === 'attack') {
      lastLog.flags = {
        ...(lastLog.flags || {}),
        comboIndex,
      };

      // Add combo indicator to description
      const comboText = ` [Liên kích x${comboIndex + 1}]`;
      if (!lastLog.description.includes('[Liên kích')) {
        lastLog.description = lastLog.description.replace(
          ' gây ',
          `${comboText} gây `,
        );
      }
    }
  }

  // Post-process logs: aggregate consecutive miss entries from same actor->target
  const compressed: CombatLogEntry[] = [];
  for (let i = 0; i < logs.length; i++) {
    const cur = logs[i];
    if (cur.type === 'miss') {
      // Count consecutive misses with same actor/target
      let count = 1;
      let j = i + 1;
      while (
        j < logs.length &&
        logs[j].type === 'miss' &&
        logs[j].actorId === cur.actorId &&
        logs[j].targetId === cur.targetId
      ) {
        count++;
        j++;
      }

      if (count === 1) {
        compressed.push(cur);
      } else {
        const aggregated: CombatLogEntry = {
          ...cur,
          description: `${cur.actorName} đánh trượt ${cur.targetName} ${count} lần liên tiếp`,
          flags: { ...(cur.flags || {}), dodgeCount: count },
        } as CombatLogEntry;
        compressed.push(aggregated);
      }
      i = j - 1;
    } else {
      compressed.push(cur);
    }
  }

  return { logs: compressed, damageTotal, actionOrderEnd: actionOrder };
}
