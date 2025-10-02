/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { CombatActorInput, CombatRunParams, CombatRunResult } from './types';
import { createRng } from './prng';
import { resolveAttack } from './resolveAttack';
import { resolveSkill } from './resolveSkill';
import { checkSkillConditions } from './condition-checker';

export function runCombat(params: CombatRunParams): CombatRunResult {
  // By default we run until one side is defeated. If a positive maxTurns is
  // provided we will cap the combat to that many turns for safety/testing.
  // Convention: maxTurns <= 0 (or omitted) => unlimited.
  const maxTurns = typeof params.maxTurns === 'number' ? params.maxTurns : 0;
  const unlimited = !maxTurns || maxTurns <= 0;
  const rng = createRng(params.seed);
  const seedUsed = (rng as any).seed;

  // clone inputs to avoid mutation
  const players: CombatActorInput[] = params.players.map((p, idx) => {
    console.log(
      `🔍 [ENGINE INIT] Player ${p.name} received stats.currentMana = ${p.stats.currentMana}, maxMana = ${p.stats.maxMana}`,
    );
    return {
      ...p,
      currentHp: p.currentHp ?? p.stats.maxHp,
      stats: {
        ...p.stats,
        currentMana: p.stats.currentMana ?? p.stats.maxMana, // ← INITIALIZE currentMana!
      },
      skillCooldowns: { ...(p.skillCooldowns || {}) }, // clone cooldowns
      _debugId: `player_${idx}_${Date.now()}`, // Unique ID for tracking
    };
  });
  const enemies: CombatActorInput[] = params.enemies.map((e) => ({
    ...e,
    currentHp: e.currentHp ?? e.stats.maxHp,
  }));

  const logs: any[] = [];
  let turn = 1;

  while (
    (unlimited || turn <= maxTurns) &&
    enemies.some((e) => (e.currentHp ?? 0) > 0) &&
    players.some((p) => (p.currentHp ?? 0) > 0)
  ) {
    // players act in input order
    for (const p of players) {
      if ((p.currentHp ?? 0) <= 0) continue;
      const aliveEnemies = enemies.filter((e) => (e.currentHp ?? 0) > 0);
      if (aliveEnemies.length === 0) break;

      // Check if player can use a skill (has skills, mana, and not on cooldown)
      const availableSkills = (p.skills || []).filter(
        (s) =>
          s.skillType === 'active' &&
          (p.stats.currentMana ?? p.stats.maxMana) >= (s.manaCost ?? 10) &&
          !(p.skillCooldowns?.[s.id] && p.skillCooldowns[s.id] > 0) &&
          checkSkillConditions(s.conditions, p, aliveEnemies, turn),
      );

      console.log(
        `Player ${p.name} has ${p.skills?.length || 0} skills, available active skills: ${availableSkills.length}, mana: ${p.stats.currentMana ?? p.stats.maxMana}`,
      );
      console.log(
        `   🔍 DEBUG: p.stats.currentMana actual value = ${p.stats.currentMana}`,
      );
      console.log(`   🆔 DEBUG: p._debugId = ${(p as any)._debugId}`);

      let usedSkill = false;
      if (availableSkills.length > 0) {
        // Use the first available skill (could implement priority logic later)
        const skill = availableSkills[0];
        const target =
          aliveEnemies[Math.floor(rng.next() * aliveEnemies.length)];

        console.log(
          `   📤 Passing player to resolveSkill: ${(p as any)._debugId}`,
        );
        const res = resolveSkill(p, skill, target, {
          rng,
          turn,
          actionOrderStart: logs.length + 1,
          allPlayers: players,
          allEnemies: enemies,
        });
        logs.push(...res.logs);

        // Set cooldown for the used skill
        if (skill.cooldown && skill.cooldown > 0) {
          if (!p.skillCooldowns) p.skillCooldowns = {};
          p.skillCooldowns[skill.id] = skill.cooldown;
        }

        usedSkill = true;
      } else {
        console.log('No skills available (no mana, on cooldown, or no skills)');
      }

      if (!usedSkill) {
        // Regular attack
        const idx = Math.floor(rng.next() * aliveEnemies.length);
        const target = aliveEnemies[idx];
        const res = resolveAttack(p, target, {
          rng,
          turn,
          actionOrderStart: logs.length + 1,
        });
        logs.push(...res.logs);
      }
    }

    // enemies act
    for (const e of enemies) {
      if ((e.currentHp ?? 0) <= 0) continue;
      const alivePlayers = players.filter((p) => (p.currentHp ?? 0) > 0);
      if (alivePlayers.length === 0) break;
      const idx = Math.floor(rng.next() * alivePlayers.length);
      const target = alivePlayers[idx];
      const res = resolveAttack(e, target, {
        rng,
        turn,
        actionOrderStart: logs.length + 1,
      });
      logs.push(...res.logs);
    }

    // Reduce skill cooldowns and regenerate mana for all players at end of turn (after both players and enemies acted)
    for (const p of players) {
      if (p.skillCooldowns) {
        for (const skillId in p.skillCooldowns) {
          if (p.skillCooldowns[skillId] > 0) {
            p.skillCooldowns[skillId]--;
          }
        }
      }

      // Regenerate mana (10% of maxMana per turn)
      const maxMana = p.stats.maxMana || 100;
      const currentMana =
        typeof p.stats.currentMana === 'number' ? p.stats.currentMana : maxMana; // Only use maxMana if currentMana is not a number
      const regenAmount = Math.floor(maxMana * 0.1);
      const newMana = Math.min(maxMana, currentMana + regenAmount);

      console.log(
        `   🔋 Mana regen for ${p.name}: ${currentMana} + ${regenAmount} = ${newMana} (max: ${maxMana})`,
      );

      p.stats.currentMana = newMana;
    }

    turn++;
  }

  const result = enemies.every((e) => (e.currentHp ?? 0) <= 0)
    ? 'victory'
    : 'defeat';

  return {
    result,
    turns: turn - 1,
    logs,
    finalPlayers: players,
    finalEnemies: enemies,
    seedUsed,
  } as CombatRunResult;
}
