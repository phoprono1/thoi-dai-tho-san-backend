import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QuestService } from '../quests/quest.service';
import { QuestType } from '../quests/quest.entity';

async function seedQuests() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const questService = app.get(QuestService);

  // Main Story Quests (with dependencies)
  const tutorialQuest = await questService.createQuest({
    name: 'Khởi đầu hành trình',
    description: 'Hoàn thành nhiệm vụ đầu tiên để bắt đầu hành trình thợ săn',
    type: QuestType.MAIN,
    requiredLevel: 1,
    requirements: {
      killEnemies: [{ enemyType: 'slime', count: 5 }],
    },
    rewards: {
      experience: 100,
      gold: 50,
    },
    isActive: true,
  });

  const firstAwakeningPrep = await questService.createQuest({
    name: 'Chuẩn bị thức tỉnh',
    description: 'Thu thập các vật liệu cần thiết để thức tỉnh lần đầu',
    type: QuestType.MAIN,
    requiredLevel: 5,
    dependencies: {
      prerequisiteQuests: [tutorialQuest.id],
    },
    requirements: {
      collectItems: [{ itemId: 1, itemName: 'Awakening Crystal', quantity: 3 }],
      reachLevel: 5,
    },
    rewards: {
      experience: 500,
      gold: 200,
    },
    isActive: true,
  });

  const firstAwakening = await questService.createQuest({
    name: 'Thức tỉnh lần 1',
    description:
      'Thực hiện nghi thức thức tỉnh để trở thành thợ săn cấp cao hơn',
    type: QuestType.MAIN,
    requiredLevel: 10,
    dependencies: {
      prerequisiteQuests: [firstAwakeningPrep.id],
      requiredLevel: 10,
    },
    requirements: {
      defeatBoss: {
        bossId: 1,
        bossName: 'Forest Guardian',
      },
    },
    rewards: {
      experience: 1000,
      gold: 500,
    },
    isActive: true,
  });

  // Side Quests
  await questService.createQuest({
    name: 'Thợ săn làng',
    description: 'Giúp đỡ người dân làng bằng cách tiêu diệt quái vật',
    type: QuestType.SIDE,
    requiredLevel: 3,
    requirements: {
      killEnemies: [
        { enemyType: 'goblin', count: 10 },
        { enemyType: 'wolf', count: 5 },
      ],
    },
    rewards: {
      experience: 300,
      gold: 150,
    },
    isActive: true,
  });

  // Daily Quests
  await questService.createQuest({
    name: 'Đánh dungeon hàng ngày',
    description: 'Hoàn thành 1 dungeon bất kỳ trong ngày',
    type: QuestType.DAILY,
    requiredLevel: 1,
    requirements: {
      completeDungeons: [
        { dungeonId: 0, dungeonName: 'Any Dungeon', count: 1 }, // dungeonId: 0 means any dungeon
      ],
    },
    rewards: {
      experience: 200,
      gold: 100,
    },
    isActive: true,
    isRepeatable: true,
  });

  await questService.createQuest({
    name: 'Săn quái hàng ngày',
    description: 'Tiêu diệt 20 quái vật bất kỳ',
    type: QuestType.DAILY,
    requiredLevel: 1,
    requirements: {
      killEnemies: [
        { enemyType: 'any', count: 20 }, // enemyType: 'any' means any enemy
      ],
    },
    rewards: {
      experience: 150,
      gold: 75,
    },
    isActive: true,
    isRepeatable: true,
  });

  await questService.createQuest({
    name: 'Thu thập nguyên liệu',
    description: 'Thu thập 10 nguyên liệu bất kỳ',
    type: QuestType.DAILY,
    requiredLevel: 1,
    requirements: {
      collectItems: [
        { itemId: 0, itemName: 'Any Material', quantity: 10 }, // itemId: 0 means any material
      ],
    },
    rewards: {
      experience: 100,
      gold: 50,
    },
    isActive: true,
    isRepeatable: true,
  });

  await app.close();
}

seedQuests().catch(console.error);
