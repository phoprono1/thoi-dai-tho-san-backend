#!/usr/bin/env node
(async function () {
  try {
    const { NestFactory } = require('@nestjs/core');
    const AppModule = require('../dist/src/app.module').AppModule;
    const CombatResultsService = require('../dist/src/combat-results/combat-results.service').CombatResultsService;

    const appContext = await NestFactory.createApplicationContext(AppModule);
    const combatService = appContext.get(CombatResultsService);

    // Use repository query to fetch the latest combat result by id
  const repo = combatService['combatResultsRepository'];
  const all = await repo.find({ order: { id: 'DESC' } });
  const latest = all && all.length > 0 ? all[0] : null;
  console.log('Latest combat result (raw):');
  console.log(JSON.stringify(latest, null, 2));

    await appContext.close();
    process.exit(0);
  } catch (err) {
    console.error('Error checking last combat:', err);
    process.exit(1);
  }
})();
