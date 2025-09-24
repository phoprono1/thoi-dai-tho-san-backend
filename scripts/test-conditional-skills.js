const { runCombat } = require('../src/combat-engine/engine');

async function testConditionalSkills() {
  console.log('Testing Conditional Skills...\n');

  // Test player with low HP condition skill
  const playerWithLowHpSkill = {
    id: 1,
    name: 'TestPlayer',
    isPlayer: true,
    stats: {
      maxHp: 100,
      attack: 20,
      defense: 5,
      critRate: 0,
      critDamage: 150,
      lifesteal: 0,
      armorPen: 0,
      dodgeRate: 0,
      accuracy: 0,
      comboRate: 0,
      counterRate: 0,
      maxMana: 100,
      currentMana: 100,
    },
    currentHp: 5, // Very low HP (5%)
    skills: [
      {
        id: 'desperate_strike',
        name: 'Desperate Strike',
        skillType: 'active',
        manaCost: 20,
        cooldown: 3,
        targetType: 'enemy',
        damageType: 'physical',
        damageFormula: 'attack * 3', // 3x damage when HP low
        conditions: [
          {
            type: 'player_hp_below',
            value: 10, // Trigger when HP <= 10%
          }
        ],
        effects: { 1: { damage: 60 } },
        level: 1,
      }
    ],
    skillCooldowns: {},
  };

  // Test enemy with low HP
  const enemyWithLowHp = {
    id: 1,
    name: 'WeakEnemy',
    isPlayer: false,
    stats: {
      maxHp: 100,
      attack: 10,
      defense: 5,
      critRate: 0,
      critDamage: 150,
      lifesteal: 0,
      armorPen: 0,
      dodgeRate: 0,
      accuracy: 0,
      comboRate: 0,
      counterRate: 0,
      maxMana: 100,
      currentMana: 100,
    },
    currentHp: 10, // Low HP enemy (10%)
  };

  console.log('Test 1: Player HP <= 10% condition');
  console.log(`Player HP: ${playerWithLowHpSkill.currentHp}/${playerWithLowHpSkill.stats.maxHp} (${(playerWithLowHpSkill.currentHp/playerWithLowHpSkill.stats.maxHp*100).toFixed(1)}%)`);
  console.log('Skill condition: player_hp_below 10%');

  const result1 = runCombat({
    players: [playerWithLowHpSkill],
    enemies: [enemyWithLowHp],
    maxTurns: 1,
  });

  console.log('Combat result:', result1.result);
  console.log('Logs:', result1.logs.map(l => `${l.type}: ${l.description}`));
  console.log();

  // Test 2: Player HP high (should not trigger)
  const playerWithHighHp = {
    ...playerWithLowHpSkill,
    currentHp: 50, // 50% HP
  };

  console.log('Test 2: Player HP > 10% condition (should not trigger)');
  console.log(`Player HP: ${playerWithHighHp.currentHp}/${playerWithHighHp.stats.maxHp} (${(playerWithHighHp.currentHp/playerWithHighHp.stats.maxHp*100).toFixed(1)}%)`);

  const result2 = runCombat({
    players: [playerWithHighHp],
    enemies: [enemyWithLowHp],
    maxTurns: 1,
  });

  console.log('Combat result:', result2.result);
  console.log('Logs:', result2.logs.map(l => `${l.type}: ${l.description}`));
  console.log();

  // Test 3: Enemy HP below condition
  const playerWithEnemyHpSkill = {
    id: 1,
    name: 'TestPlayer',
    isPlayer: true,
    stats: {
      maxHp: 100,
      attack: 20,
      defense: 5,
      critRate: 0,
      critDamage: 150,
      lifesteal: 0,
      armorPen: 0,
      dodgeRate: 0,
      accuracy: 0,
      comboRate: 0,
      counterRate: 0,
      maxMana: 100,
      currentMana: 100,
    },
    currentHp: 100,
    skills: [
      {
        id: 'execute',
        name: 'Execute',
        skillType: 'active',
        manaCost: 30,
        cooldown: 5,
        targetType: 'enemy',
        damageType: 'physical',
        damageFormula: 'attack * 5', // 5x damage on low HP enemies
        conditions: [
          {
            type: 'enemy_hp_below',
            value: 15, // Trigger when enemy HP <= 15%
          }
        ],
        effects: { 1: { damage: 100 } },
        level: 1,
      }
    ],
    skillCooldowns: {},
  };

  console.log('Test 3: Enemy HP <= 15% condition');
  console.log(`Enemy HP: ${enemyWithLowHp.currentHp}/${enemyWithLowHp.stats.maxHp} (${(enemyWithLowHp.currentHp/enemyWithLowHp.stats.maxHp*100).toFixed(1)}%)`);
  console.log('Skill condition: enemy_hp_below 15%');

  const result3 = runCombat({
    players: [playerWithEnemyHpSkill],
    enemies: [enemyWithLowHp],
    maxTurns: 1,
  });

  console.log('Combat result:', result3.result);
  console.log('Logs:', result3.logs.map(l => `${l.type}: ${l.description}`));
  console.log();

  // Test 4: Enemy HP high (should not trigger)
  const enemyWithHighHp = {
    ...enemyWithLowHp,
    currentHp: 80, // 80% HP
  };

  console.log('Test 4: Enemy HP > 15% condition (should not trigger)');
  console.log(`Enemy HP: ${enemyWithHighHp.currentHp}/${enemyWithHighHp.stats.maxHp} (${(enemyWithHighHp.currentHp/enemyWithHighHp.stats.maxHp*100).toFixed(1)}%)`);

  const result4 = runCombat({
    players: [playerWithEnemyHpSkill],
    enemies: [enemyWithHighHp],
    maxTurns: 1,
  });

  console.log('Combat result:', result4.result);
  console.log('Logs:', result4.logs.map(l => `${l.type}: ${l.description}`));
}

testConditionalSkills().catch(console.error);