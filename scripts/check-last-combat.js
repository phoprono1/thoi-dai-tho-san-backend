#!/usr/bin/env node
(async function () {
  try {
    const { NestFactory } = require('@nestjs/core');
    const AppModule = require('../dist/src/app.module').AppModule;
    const CombatResultsService = require('../dist/src/combat-results/combat-results.service').CombatResultsService;

    const appContext = await NestFactory.createApplicationContext(AppModule);
    const combatService = appContext.get(CombatResultsService);

    // Find the most recent combat result by highest id
    const all = await combatService.findAll();
    if (!all || all.length === 0) {
      console.log('No combat results found');
      await appContext.close();
      process.exit(0);
    }

    const last = all.reduce((a, b) => (a.id > b.id ? a : b));
    const full = await combatService.findOne(last.id);
    console.log('CombatResult entity from DB:');
    console.log(JSON.stringify(full, null, 2));
    await appContext.close();
    process.exit(0);
  } catch (err) {
    console.error('Error checking last combat:', err);
    process.exit(1);
  }
})();
