/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { CombatActorInput, CombatRunParams, CombatRunResult } from './types';
import { createRng } from './prng';
import { resolveAttack } from './resolveAttack';

export function runCombat(params: CombatRunParams): CombatRunResult {
  const maxTurns = params.maxTurns ?? 50;
  const rng = createRng(params.seed);
  const seedUsed = (rng as any).seed;

  // clone inputs to avoid mutation
  const players: CombatActorInput[] = params.players.map((p) => ({
    ...p,
    currentHp: p.currentHp ?? p.stats.maxHp,
  }));
  const enemies: CombatActorInput[] = params.enemies.map((e) => ({
    ...e,
    currentHp: e.currentHp ?? e.stats.maxHp,
  }));

  const logs: any[] = [];
  let turn = 1;

  while (
    turn <= maxTurns &&
    enemies.some((e) => (e.currentHp ?? 0) > 0) &&
    players.some((p) => (p.currentHp ?? 0) > 0)
  ) {
    // players act in input order
    for (const p of players) {
      if ((p.currentHp ?? 0) <= 0) continue;
      const aliveEnemies = enemies.filter((e) => (e.currentHp ?? 0) > 0);
      if (aliveEnemies.length === 0) break;
      const idx = Math.floor(rng.next() * aliveEnemies.length);
      const target = aliveEnemies[idx];
      const res = resolveAttack(p, target, {
        rng,
        turn,
        actionOrderStart: logs.length + 1,
      });
      logs.push(...res.logs);
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
