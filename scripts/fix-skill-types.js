#!/usr/bin/env node
// Script to fix active skill types in database
(async function () {
  try {
    const { NestFactory } = require('@nestjs/core');
    const AppModule = require('../dist/src/app.module').AppModule;

    const appContext = await NestFactory.createApplicationContext(AppModule);
    const skillDefRepo = appContext.get('SkillDefinitionRepository');

    console.log('=== Fixing Active Skill Types ===');

    // Find and update Quick Attack skill definition
    const quickAttackDef = await skillDefRepo.findOne({
      where: { name: 'Quick Attack' }
    });

    if (quickAttackDef && quickAttackDef.skillType === 'passive') {
      console.log(`Found Quick Attack with passive type, updating to active...`);
      quickAttackDef.skillType = 'active';
      await skillDefRepo.save(quickAttackDef);
      console.log('Updated Quick Attack skill definition to active type');
    } else if (quickAttackDef) {
      console.log('Quick Attack is already active type');
    } else {
      console.log('Quick Attack skill definition not found');
    }

    console.log('Done!');
    await appContext.close();
  } catch (err) {
    console.error('Error:', err);
  }
})();