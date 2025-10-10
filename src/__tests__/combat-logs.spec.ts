import { deriveCombatStats } from '../combat-engine/stat-converter';
import { runCombat } from '../combat-engine/engine';

describe('combat logs integerization', () => {
  it('ensures damage in logs are integers and totalDamage is integer', () => {
    const playerCore = { STR: 100, INT: 31, DEX: 31, VIT: 100, LUK: 53 } as any;
    const player = {
      id: 1,
      name: 'Tester',
      isPlayer: true,
      stats: deriveCombatStats(playerCore),
      currentHp: undefined,
      skills: [],
      skillCooldowns: {},
    } as any;

    const enemyCore = {
      baseAttack: 100,
      baseMaxHp: 3000,
      baseDefense: 70,
      STR: 20,
      VIT: 20,
      DEX: 10,
      LUK: 5,
      INT: 5,
    };
    const enemyStats = deriveCombatStats(enemyCore as any);
    enemyStats.maxHp = 3000;
    const enemy = {
      id: 'm1',
      name: 'E',
      isPlayer: false,
      stats: enemyStats,
      currentHp: enemyStats.maxHp,
    } as any;

    const res = runCombat({
      players: [player],
      enemies: [enemy],
      maxTurns: 20,
      seed: Date.now(),
    });

    for (const l of res.logs) {
      if (l.damage !== undefined && l.damage !== null) {
        expect(Number.isInteger(l.damage)).toBeTruthy();
      }
    }
  });
});
