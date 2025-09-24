#!/usr/bin/env node
// Quick script to test wild area combat (startCombatWithEnemies)
(async function () {
  try {
    const { NestFactory } = require('@nestjs/core');
    const AppModule = require('../dist/src/app.module').AppModule;
    const CombatResultsService = require('../dist/src/combat-results/combat-results.service').CombatResultsService;

    const appContext = await NestFactory.createApplicationContext(AppModule);
    const combatService = appContext.get(CombatResultsService);

    // Test wild area combat with a simple enemy
    const enemies = [{ monsterId: 1, count: 1 }]; // Assuming monster ID 1 exists
    const res = await combatService.startCombatWithEnemies([4], enemies, { source: 'wildarea' });

    console.log('Wild Area Combat Result:');
    console.log(JSON.stringify({
      result: res.result,
      teamStats: res.teamStats,
      sampleDamage: res.logs[0]?.details?.damage,
      sampleHp: res.teamStats.members[0]?.hp
    }, null, 2));

    await appContext.close();
    process.exit(0);
  } catch (err) {
    console.error('Error running wild area combat test:', err);
    process.exit(1);
  }
})();