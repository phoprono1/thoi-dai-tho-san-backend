import { runCombat } from '../src/combat-engine/engine';
import { deriveCombatStats } from '../src/combat-engine/stat-converter';

function makePlayerProfile(core: any) {
  return {
    id: 1,
    name: 'SimPlayer',
    isPlayer: true,
    stats: deriveCombatStats(core),
    currentHp: undefined,
    skills: [],
    skillCooldowns: {},
  };
}

function makeEnemyProfile(stats: any) {
  return {
    id: 'm1',
    name: 'SimEnemy',
    isPlayer: false,
    stats,
    currentHp: stats.maxHp,
  };
}

function summarizeRuns(results: any[]) {
  const metrics = {
    runs: results.length,
    avgTurns: 0,
    avgPlayerDamagePerTurn: 0,
    avgEnemyDamagePerTurn: 0,
    avgLogs: 0,
    critRate: 0,
    missRate: 0,
  } as any;

  let totalTurns = 0;
  let totalPlayerDamage = 0;
  let totalEnemyDamage = 0;
  let totalLogs = 0;
  let totalHits = 0;
  let totalMisses = 0;
  let totalCrits = 0;

  for (const r of results) {
    totalTurns += r.turns || 0;
    totalLogs += (r.logs || []).length;
    for (const l of r.logs || []) {
      if (l.type === 'attack' || l.type === 'skill') {
        if (l.actor === 'player') totalPlayerDamage += l.damage || 0;
        else totalEnemyDamage += l.damage || 0;

        if (l.type === 'attack' || l.type === 'skill') {
          if (l.damage && l.damage > 0) totalHits++;
          if (l.type === 'miss') totalMisses++;
          if (l.flags && l.flags.crit) totalCrits++;
        }
      }
    }
  }

  metrics.avgTurns = totalTurns / results.length;
  metrics.avgPlayerDamagePerTurn = totalPlayerDamage / Math.max(1, totalTurns);
  metrics.avgEnemyDamagePerTurn = totalEnemyDamage / Math.max(1, totalTurns);
  metrics.avgLogs = totalLogs / results.length;
  metrics.critRate = totalCrits / Math.max(1, totalHits);
  metrics.missRate = totalMisses / Math.max(1, totalMisses + totalHits);

  return metrics;
}

async function runSim() {
  const runs = 500;
  const results: any[] = [];

  const playerCore = { STR: 100, INT: 31, DEX: 31, VIT: 100, LUK: 53 };
  const player = makePlayerProfile(playerCore);

  for (let i = 0; i < runs; i++) {
    const enemyCore = { baseAttack: 100, baseMaxHp: 3000, baseDefense: 70, STR: 20, VIT: 20, DEX: 10, LUK: 5, INT: 5 };
    const enemyStats = deriveCombatStats(enemyCore);
    enemyStats.maxHp = 3000; // force
    const enemy = makeEnemyProfile(enemyStats);

    const res = runCombat({ players: [player], enemies: [enemy], maxTurns: 50, seed: Date.now() + i });
    results.push({ turns: res.turns, logs: res.logs });
  }

  const summary = summarizeRuns(results);
  console.log('Simulation summary:', summary);
}

runSim().catch((e) => {
  console.error('simulate-combat failed', e);
  process.exit(1);
});
