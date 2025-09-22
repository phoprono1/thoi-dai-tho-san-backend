const { UsersService } = require('../dist/users/users.service');
const { DataSource } = require('typeorm');
const { User } = require('../dist/users/user.entity');
const { UserStat } = require('../dist/user-stats/user-stat.entity');
const { Level } = require('../dist/levels/level.entity');
const { CharacterClass } = require('../dist/character-classes/character-class.entity');
const { Item } = require('../dist/items/item.entity');
const { ItemSet } = require('../dist/items/item-set.entity');
const { UserItem } = require('../dist/user-items/user-item.entity');
const { UserPower } = require('../dist/user-power/user-power.entity');
const { UserStamina } = require('../dist/user-stamina/user-stamina.entity');

async function testLevelUp() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'thoi_dai_tho_san',
    entities: [User, UserStat, Level, CharacterClass, Item, ItemSet, UserItem, UserPower, UserStamina],
    synchronize: false,
  });

  await dataSource.initialize();

  const usersService = new UsersService(
    dataSource.getRepository(User),
    null, // levelsService
    null, // userStatsService
    null, // userPowerService
    dataSource,
    null, // eventsService
  );

  // Mock dependencies
  usersService.levelsService = {
    getNextLevel: async (level) => ({ level: level + 1, experienceRequired: 1000 }),
    getLevelStats: async (level) => ({ maxHp: 100, attack: 10, defense: 5 }),
  };

  usersService.userStatsService = {
    applyLevelUpStats: async (userId, levelStats) => {
      console.log(`Applying level up stats for user ${userId}:`, levelStats);
    },
  };

  usersService.userPowerService = {
    computeAndSaveForUser: async (userId) => {
      console.log(`Computing power for user ${userId}`);
      return 1000;
    },
  };

  usersService.eventsService = {
    emit: (event, payload) => {
      console.log(`Emitted event ${event}:`, payload);
    },
  };

  try {
    const userId = 33;
    console.log('Before level up:');
    const userBefore = await usersService.findOne(userId);
    console.log('User level:', userBefore.level, 'Experience:', userBefore.experience);

    // Set experience to enough for level up
    await dataSource.getRepository(User).update(userId, { experience: 1000 });

    console.log('Leveling up...');
    const userAfter = await usersService.levelUpUser(userId);
    console.log('After level up:');
    console.log('User level:', userAfter.level, 'Experience:', userAfter.experience);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await dataSource.destroy();
  }
}

testLevelUp();