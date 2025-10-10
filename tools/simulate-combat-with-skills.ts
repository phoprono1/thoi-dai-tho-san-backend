// simulate-combat-with-skills.ts
// Simulate combats where player has Quick Attack and Hỏa cầu skills (mocked), produce report.

const originalConsoleLog = console.log;
console.log = () => {};

const { runCombat } = require('../src/combat-engine/engine');
const { deriveCombatStats } = require('../src/combat-engine/stat-converter');
const fs = require('fs');
const path = require('path');

function restoreConsole() {
  console.log = originalConsoleLog;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

async function runLarge() {
  const runs = 1000;
  const results = [];

  const playerCore = { STR: 100, INT: 31, DEX: 31, VIT: 100, LUK: 53 };
  const playerStats = deriveCombatStats(playerCore);
  playerStats.currentMana = playerStats.maxMana = playerStats.maxMana || 300;

  // Mock skills
  const quickAttack = {
    id: 1,
    name: 'Quick Attack',
    skillType: 'active',
    manaCost: 20,
    cooldown: 1,
    targetType: 'enemy',
    damageType: 'physical',
    damageFormula: 'attack * 7 + 50', // large multiplier to match observed logs
    effects: {},
    level: 1,
  };

  const fireball = {
    id: 2,
    name: 'Hỏa cầu',
    skillType: 'active',
    manaCost: 10,
    cooldown: 2,
    targetType: 'enemy',
    damageType: 'magical',
    damageFormula: 'attack * 1 + 2',
    effects: {},
    level: 1,
  };

  const player = {
    id: 1,
    name: 'SkillSim',
    isPlayer: true,
    stats: playerStats,
    currentHp: undefined,
    skills: [quickAttack, fireball],
    skillCooldowns: {},
    metadata: {},
  };

  const enemyCore = { baseAttack: 100, baseMaxHp: 3000, baseDefense: 70, STR: 20, VIT: 20, DEX: 10, LUK: 5, INT: 5 };
  const enemyStatsTemplate = deriveCombatStats(enemyCore);
  enemyStatsTemplate.maxHp = 3000;

  for (let i = 0; i < runs; i++) {
    const enemy = {
      id: `m_${i}`,
      name: 'Quỷ Slime',
      isPlayer: false,
      stats: { ...enemyStatsTemplate },
      currentHp: enemyStatsTemplate.maxHp,
    };

    const res = runCombat({ players: [player], enemies: [enemy], maxTurns: 50, seed: Date.now() + i });
    results.push(res);
  }

  // Aggregate
  let totalTurns = 0;
  let totalPlayerDamage = 0;
  let totalEnemyDamage = 0;
  let hitCount = 0;
  let missCount = 0;
  let critCount = 0;
  const damagePerHit = [];
  const logsPerRun = [];

  for (const r of results) {
    totalTurns += r.turns || 0;
    const logs = r.logs || [];
    logsPerRun.push(logs.length);
    for (const l of logs) {
      if (!l) continue;
      if (l.type === 'attack' || l.type === 'skill') {
        if (l.actor === 'player') totalPlayerDamage += l.damage || 0;
        else totalEnemyDamage += l.damage || 0;
        if (l.damage && l.damage > 0) {
          damagePerHit.push(l.damage || 0);
          hitCount++;
        }
        if (l.type === 'miss') missCount++;
        if (l.flags && l.flags.crit) critCount++;
      } else if (l.type === 'miss') {
        missCount++;
      }
    }
  }

  const avgTurns = totalTurns / results.length;
  const avgLogs = logsPerRun.reduce((a,b)=>a+b,0)/results.length;
  const avgPlayerDmgPerTurn = totalPlayerDamage / Math.max(1, totalTurns);
  const avgEnemyDmgPerTurn = totalEnemyDamage / Math.max(1, totalTurns);
  const hitRate = hitCount / Math.max(1, hitCount + missCount);
  const missRate = missCount / Math.max(1, hitCount + missCount);
  const critRate = critCount / Math.max(1, hitCount);

  const p25 = percentile(damagePerHit, 25);
  const p50 = percentile(damagePerHit, 50);
  const p75 = percentile(damagePerHit, 75);
  const p90 = percentile(damagePerHit, 90);
  const p99 = percentile(damagePerHit, 99);

  const report = [];
  report.push('# Combat Skill Simulation Report');
  report.push(`Date: ${new Date().toISOString()}`);
  report.push('');
  report.push('## Parameters');
  report.push('- Runs: ' + runs);
  report.push('- Player core: ' + JSON.stringify(playerCore));
  report.push('- Skills: Quick Attack (attack*7+50), Hỏa cầu (attack*1+2)');
  report.push('');
  report.push('## Summary Metrics');
  report.push(`- avgTurns: ${avgTurns.toFixed(2)}`);
  report.push(`- avgLogsPerRun: ${avgLogs.toFixed(2)}`);
  report.push(`- avgPlayerDamagePerTurn: ${avgPlayerDmgPerTurn.toFixed(2)}`);
  report.push(`- avgEnemyDamagePerTurn: ${avgEnemyDmgPerTurn.toFixed(2)}`);
  report.push(`- hitRate: ${(hitRate * 100).toFixed(2)}%`);
  report.push(`- missRate: ${(missRate * 100).toFixed(2)}%`);
  report.push(`- critRate (per hit): ${(critRate * 100).toFixed(2)}%`);
  report.push('');
  report.push('## Damage per hit percentiles');
  report.push(`- p25: ${p25}`);
  report.push(`- p50 (median): ${p50}`);
  report.push(`- p75: ${p75}`);
  report.push(`- p90: ${p90}`);
  report.push(`- p99: ${p99}`);
  report.push('');
  report.push('## Logs per run distribution');
  report.push(`- min: ${Math.min(...logsPerRun)}`);
  report.push(`- max: ${Math.max(...logsPerRun)}`);
  report.push(`- avg: ${avgLogs.toFixed(2)}`);
  report.push('');
  report.push('## Recommendations');
  report.push('- If Quick Attack damage distribution (p75/p99) too high, reduce multiplier (e.g., 7 -> 5) or lower base +50.');
  report.push('- If player DPS low compared to enemy, consider raising skill frequency (reduce cooldown) or lower enemy defense formula.');

  const outPath = path.join(__dirname, `simulation-skill-report-${new Date().toISOString().slice(0,10)}.md`);
  fs.writeFileSync(outPath, report.join('\n'));
  restoreConsole();
  console.log('Skill simulation completed. Report written to', outPath);
  console.log(report.join('\n'));
}

runLarge().catch((e)=>{
  restoreConsole();
  console.error('simulate-combat-with-skills failed', e);
  process.exit(1);
});

export {};
