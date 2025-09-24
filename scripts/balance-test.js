// Simple balance test for Free Attribute Points system
console.log('🧪 Free Attribute Points Balance Test\n');

// Test level progression
console.log('📊 Level Progression (3-6 points per level):');
let totalPoints = 0;
for (let level = 1; level <= 50; level++) {
  const pointsReward = Math.min(6, Math.floor(level / 10) + 3);
  totalPoints += pointsReward;

  if (level <= 10 || level % 10 === 0) {
    console.log(`Level ${level}: ${pointsReward} points (Total: ${totalPoints})`);
  }
}

console.log(`\n🎯 Final Stats:`);
console.log(`Total points at Lv.50: ${totalPoints}`);
console.log(`Average points per level: ${(totalPoints / 50).toFixed(1)}`);

// Test attribute impact
console.log('\n⚔️ Attribute Impact Test:');
console.log('Base STR: 10, Allocate 10 points to STR');

const baseSTR = 10;
const allocatedPoints = 10;
const totalSTR = baseSTR + allocatedPoints;

const effectiveSTR = Math.pow(totalSTR, 0.94);
const attackFromSTR = 0.45 * effectiveSTR;

const baseEffectiveSTR = Math.pow(baseSTR, 0.94);
const baseAttackFromSTR = 0.45 * baseEffectiveSTR;

console.log(`Attack contribution: ${baseAttackFromSTR.toFixed(1)} → ${attackFromSTR.toFixed(1)}`);
console.log(`Improvement: +${(attackFromSTR - baseAttackFromSTR).toFixed(1)} attack`);
console.log(`Percentage: +${(((attackFromSTR / baseAttackFromSTR) - 1) * 100).toFixed(1)}%`);

console.log('\n✅ Balance test complete!');