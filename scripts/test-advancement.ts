import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CharacterClassService } from '../src/character-classes/character-class.service';
import { QuestService } from '../src/quests/quest.service';
import { User } from '../src/users/user.entity';
import { UserStat } from '../src/user-stats/user-stat.entity';
import { CombatResult, CombatResultType } from '../src/combat-results/combat-result.entity';
import { UserItem } from '../src/user-items/user-item.entity';
import { DataSource } from 'typeorm';

async function testCharacterAdvancement() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const characterClassService = app.get(CharacterClassService);
  const questService = app.get(QuestService);
  const dataSource = app.get(DataSource);

  // Create test user
  const userRepository = dataSource.getRepository(User);
  const userStatRepository = dataSource.getRepository(UserStat);
  const combatResultRepository = dataSource.getRepository(CombatResult);
  const userItemRepository = dataSource.getRepository(UserItem);

  const testUser = await userRepository.save({
    username: 'test_warrior',
    email: 'test@example.com',
    password: 'hashedpassword',
    level: 15,
  });

  const testUserStats = await userStatRepository.save({
    userId: testUser.id,
    strength: 10,
    intelligence: 5,
    dexterity: 8,
    vitality: 12,
    luck: 3,
    maxHp: 120,
    attack: 20,
    defense: 18,
  });

  // Test 1: Check available advancements before requirements
  const availableBefore = await characterClassService.getAvailableAdvancements(testUser.id);

  // Test 2: Complete quest requirements

  // Start and complete the Warrior's Path quest
  await questService.startQuest(testUser.id, 1);

  // Update quest progress (simulate killing enemies)
  await questService.updateQuestProgress(testUser.id, 1, {
    killEnemies: [
      { enemyType: 'goblin', current: 5, required: 5 },
      { enemyType: 'orc', current: 3, required: 3 }
    ],
    currentLevel: 15
  });

  // Add dungeon completions
  await combatResultRepository.save({
    dungeonId: 1,
    userIds: [testUser.id],
    result: CombatResultType.VICTORY,
    duration: 300000,
    rewards: { experience: 100, gold: 50 }
  });

  await combatResultRepository.save({
    dungeonId: 1,
    userIds: [testUser.id],
    result: CombatResultType.VICTORY,
    duration: 320000,
    rewards: { experience: 100, gold: 50 }
  });

  // Test 3: Check available advancements after completing requirements
  const availableAfter = await characterClassService.getAvailableAdvancements(testUser.id);

  // Test 4: Perform advancement
  if (availableAfter.availableClasses.length > 0) {
    try {
      const advancementResult = await characterClassService.performAdvancement({
        userId: testUser.id,
        targetClassId: availableAfter.availableClasses[0].id
      });

    } catch (error) {
      // Advancement failed
    }
  }

  // Cleanup
  await userItemRepository.delete({ userId: testUser.id });
  // Delete combat results where user is in userIds array
  await combatResultRepository.query(`DELETE FROM combat_result WHERE ${testUser.id} = ANY(user_ids)`);
  await userStatRepository.delete({ userId: testUser.id });
  await userRepository.delete({ id: testUser.id });

  await app.close();
}

testCharacterAdvancement().catch(console.error);
