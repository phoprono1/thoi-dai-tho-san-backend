#!/usr/bin/env node
// Quick script to call the compiled combat service from dist to run an ad-hoc test.
// This avoids HTTP and uses the same DI bootstrap used in main.ts.
(async function () {
  try {
    const { NestFactory } = require('@nestjs/core');
    const AppModule = require('../dist/src/app.module').AppModule;
    const CombatResultsService = require('../dist/src/combat-results/combat-results.service').CombatResultsService;

    const appContext = await NestFactory.createApplicationContext(AppModule);
    const combatService = appContext.get(CombatResultsService);
    const res = await combatService.startCombat([12], 12);
    console.log(JSON.stringify(res, null, 2));
    await appContext.close();
    process.exit(0);
  } catch (err) {
    console.error('Error running test combat:', err);
    process.exit(1);
  }
})();
