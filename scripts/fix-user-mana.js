#!/usr/bin/env node
// Script to fix user mana by adding INT attribute points
(async function () {
  try {
    const { NestFactory } = require('@nestjs/core');
    const AppModule = require('../dist/src/app.module').AppModule;

    const appContext = await NestFactory.createApplicationContext(AppModule);
    const userRepo = appContext.get('UserRepository');
    const userStatsRepo = appContext.get('UserStatRepository');

    console.log('=== Fixing User Mana ===');

    // Get user stats
    const userStats = await userStatsRepo.findOne({ where: { userId: 2 } });

    if (!userStats) {
      console.log('User stats not found, creating new stats...');
      // Create new stats with INT points
      await userStatsRepo.save({
        userId: 2,
        str: 5,
        int: 10, // Add INT for mana
        dex: 5,
        vit: 5,
        luk: 5,
        maxHp: 100,
        maxMana: 50, // 10 INT * 5 = 50 mana
        currentMana: 50,
        attack: 10,
        defense: 5,
        critRate: 0.05,
        critDamage: 1.5,
        dodgeRate: 0.05,
        accuracy: 0.9,
        lifesteal: 0,
        armorPen: 0,
        comboRate: 0
      });
      console.log('Created user stats with INT=10, maxMana=50');
    } else {
      console.log('Updating existing user stats...');
      userStats.int = 10;
      userStats.maxMana = 50; // Recalculate based on INT
      userStats.currentMana = 50;
      await userStatsRepo.save(userStats);
      console.log('Updated user stats: INT=10, maxMana=50, currentMana=50');
    }

    await appContext.close();
    console.log('Done!');
  } catch (err) {
    console.error('Error:', err);
  }
})();