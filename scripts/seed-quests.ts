import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { QuestService } from '../src/quests/quest.service';
import { QuestType } from '../src/quests/quest.entity';

async function seedQuests() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const questService = app.get(QuestService);

  // Quest for Basic -> Intermediate advancement
  const basicToIntermediateQuest = await questService.createQuest({
    name: "Warrior's Path",
    description: 'Complete your training as a basic warrior',
    type: QuestType.MAIN,
    requiredLevel: 1,
    isActive: true,
    requirements: {
      reachLevel: 10,
      killEnemies: [
        { enemyType: 'goblin', count: 5 },
        { enemyType: 'orc', count: 3 }
      ],
      completeDungeons: [
        { dungeonId: 1, dungeonName: 'Training Grounds', count: 2 }
      ]
    },
    rewards: {
      experience: 1000,
      gold: 500,
      items: [
        { itemId: 1, itemName: "Warrior's Medal", quantity: 1 }
      ]
    }
  });

  // Quest for Intermediate -> Advanced advancement
  const intermediateToAdvancedQuest = await questService.createQuest({
    name: 'Elite Warrior',
    description: 'Prove your worth as an elite warrior',
    type: QuestType.MAIN,
    requiredLevel: 10,
    isActive: true,
    requirements: {
      reachLevel: 20,
      killEnemies: [
        { enemyType: 'troll', count: 10 },
        { enemyType: 'dragon', count: 1 }
      ],
      completeDungeons: [
        { dungeonId: 2, dungeonName: "Dragon's Lair", count: 5 }
      ],
      collectItems: [
        { itemId: 2, itemName: 'Dragon Scale', quantity: 3 }
      ]
    },
    rewards: {
      experience: 5000,
      gold: 2000,
      items: [
        { itemId: 3, itemName: 'Elite Badge', quantity: 1 }
      ]
    }
  });

  await app.close();
}

seedQuests().catch(console.error);
