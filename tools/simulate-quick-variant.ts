// simulate-quick-variant.ts
// Loads repo skills, replaces quick_attack damageFormula with safer variant, run sims

const originalConsoleLog = console.log;
console.log = () => {};

const path = require('path');
const fs = require('fs');
const baseSkills: any[] = require('../scripts/base-skills.js');
const { runCombat } = require('../src/combat-engine/engine');
const { deriveCombatStats } = require('../src/combat-engine/stat-converter');

function restoreConsole() {
  console.log = originalConsoleLog;
}

function percentile(arr: number[], p: number) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

async function runVariant() {
  const runs = 1000;
  const results: any[] = [];

  // Clone and modify skills
  const skills = JSON.parse(JSON.stringify(baseSkills));
  const q = skills.find((s: any) => s.skillId === 'quick_attack');
  if (!q) throw new Error('quick_attack not found');
  q.damageFormula = 'attack * 0.6 + level * 3';

  const quickSkill = {
    id: q.skillId,
    name: q.name,
    skillType: q.skillType || 'active',
    manaCost: q.manaCost ?? 10,
    cooldown: q.cooldown ?? 0,
    targetType: q.targetType || 'enemy',
    damageType: q.damageType || null,
    damageFormula: q.damageFormula || undefined,
    effects: q.effects || {},
    level: 1,
  };

  const fb = skills.find((s: any) => s.skillId === 'fireball');
  if (!fb) throw new Error('fireball not found');
  const fireballSkill = {
    id: fb.skillId,
    name: fb.name,
    skillType: fb.skillType || 'active',
    manaCost: fb.manaCost ?? 10,
    cooldown: fb.cooldown ?? 0,
    targetType: fb.targetType || 'enemy',
    damageType: fb.damageType || null,
    damageFormula: fb.damageFormula || undefined,
    effects: fb.effects || {},
    level: 1,
  };

  const playerCore = { STR: 100, INT: 40, DEX: 31, VIT: 100, LUK: 53 };
  const playerStats = deriveCombatStats(playerCore);
  playerStats.currentMana = playerStats.maxMana = playerStats.maxMana || 300;

  const playerTemplate = {
    id: 'sim_player',
    name: 'QuickVariantSim',
    isPlayer: true,
    stats: playerStats,
    skills: [quickSkill, fireballSkill],
    metadata: {
      totalStrength: playerCore.STR,
      totalIntelligence: playerCore.INT,
      totalDexterity: playerCore.DEX,
      totalVitality: playerCore.VIT,
      totalLuck: playerCore.LUK,
    },
  };

  const enemyStatsTemplate = deriveCombatStats({ STR: 20, INT: 5, DEX: 10, VIT: 20, LUK: 5 });
  enemyStatsTemplate.maxHp = 3000;

  for (let i = 0; i < runs; i++) {
    const player = JSON.parse(JSON.stringify(playerTemplate));
    player.currentHp = player.stats.maxHp;
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

  // Aggregate metrics (same as previous scripts)
  let totalTurns = 0;
  let totalPlayerDamage = 0;
  let totalEnemyDamage = 0;
  let hitCount = 0;
  let missCount = 0;
  let critCount = 0;
  const damagePerHit: number[] = [];
  const logsPerRun: number[] = [];

  for (const r of results) {
    totalTurns += r.turns || 0;
    const logs = r.logs || [];
    logsPerRun.push(logs.length);
    for (const l of logs) {
      if (!l) continue;
      if (l.type === 'skill' || l.type === 'attack') {
        if (l.actorIsPlayer) totalPlayerDamage += l.damage || 0;
        else totalEnemyDamage += l.damage || 0;
        if (typeof l.damage === 'number' && l.damage > 0) {
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
  report.push('# Combat Simulation Report (Quick Attack Variant)');
  report.push(`Date: ${new Date().toISOString()}`);
  report.push('');
  report.push('## Parameters');
  report.push('- Runs: ' + runs);
  report.push('- Player core: ' + JSON.stringify(playerCore));
  report.push(`- Quick Attack formula overridden to: ${q.damageFormula}`);
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
  report.push('- Use derived `attack` in formulas or cap multipliers to avoid runaway damage.');

  const outPath = path.join(__dirname, `simulation-quick-variant-report-${new Date().toISOString().slice(0,10)}.md`);
  fs.writeFileSync(outPath, report.join('\n'));
  restoreConsole();
  console.log('Quick-variant simulation completed. Report written to', outPath);
  console.log(report.join('\n'));
}

runVariant().catch((e)=>{
  restoreConsole();
  console.error('simulate-quick-variant failed', e);
  process.exit(1);
});

export {};
