#!/usr/bin/env node
// Script to check user skills and mana
(async function () {
  try {
    const { NestFactory } = require('@nestjs/core');
    const AppModule = require('../dist/src/app.module').AppModule;

    const appContext = await NestFactory.createApplicationContext(AppModule);
    const userRepo = appContext.get('UserRepository');
    const playerSkillRepo = appContext.get('PlayerSkillRepository');
    const userStatsRepo = appContext.get('UserStatRepository');

    console.log('=== Checking User Skills and Mana ===');

    const user = await userRepo.findOne({
      where: { id: 2 },
      relations: ['stats']
    });

    const playerSkills = await playerSkillRepo.find({
      where: { userId: 2 },
      relations: ['skillDefinition']
    });

    // Also get user stats separately to ensure it's loaded
    const userStats = await userStatsRepo.findOne({ where: { userId: 2 } });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log(`User: ${user.username}`);
    console.log(`Level: ${user.level}`);
    console.log(`Stats:`, {
      str: userStats?.strength || 0,
      int: userStats?.intelligence || 0,
      vit: userStats?.vitality || 0,
      dex: userStats?.dexterity || 0,
      luk: userStats?.luck || 0,
      currentHp: userStats?.currentHp || 0,
      // Mana calculated from INT
      calculatedMaxMana: Math.floor((userStats?.intelligence || 0) * 10)
    });

    console.log('\nSkills:');
    if (playerSkills && playerSkills.length > 0) {
      playerSkills.forEach(skill => {
        console.log(`- ${skill.skillDefinition?.name} (Level: ${skill.level}, Type: ${skill.skillDefinition?.skillType})`);
        console.log(`  Mana Cost: ${skill.skillDefinition?.manaCost || 0}`);
        const calculatedMaxMana = Math.floor((userStats?.intelligence || 0) * 10);
        console.log(`  Available: ${skill.skillDefinition?.skillType === 'active' && calculatedMaxMana >= (skill.skillDefinition?.manaCost || 0) ? 'YES' : 'NO'}`);
      });
    } else {
      console.log('No skills found');
    }

    await appContext.close();
  } catch (err) {
    console.error('Error:', err);
  }
})();