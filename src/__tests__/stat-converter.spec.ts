import { deriveCombatStats, CONFIG } from '../combat-engine/stat-converter';

describe('deriveCombatStats softcaps', () => {
  it('applies crit/dodge/accuracy softcaps', () => {
    const core = { STR: 10, INT: 5, DEX: 200, VIT: 10, LUK: 300 } as any;
    const stats = deriveCombatStats(core);

    // Crit should not exceed configured hard cap / softcap area
    expect(stats.critRate).toBeLessThanOrEqual(CONFIG.SOFTCAP.critCap + 0.001);

    // Dodge should be <= dodgeCap
    expect(stats.dodgeRate).toBeLessThanOrEqual(
      CONFIG.SOFTCAP.dodgeCap + 0.001,
    );

    // Accuracy should be <= accuracyCap
    expect(stats.accuracy).toBeLessThanOrEqual(
      CONFIG.SOFTCAP.accuracyCap + 0.001,
    );
  });
});
