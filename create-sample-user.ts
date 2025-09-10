import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';
import { User } from './src/users/user.entity';
import { UserStat } from './src/user-stats/user-stat.entity';
import { UserStamina } from './src/user-stamina/user-stamina.entity';
import { Level } from './src/levels/level.entity';

async function createSampleUser(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  const userStatsRepository = dataSource.getRepository(UserStat);
  const userStaminaRepository = dataSource.getRepository(UserStamina);
  const levelRepository = dataSource.getRepository(Level);

  // Create sample user
  const user = userRepository.create({
    username: 'TestPlayer',
    password: 'hashedpassword', // In real app, this would be hashed
    level: 1,
    experience: 0,
    gold: 1000,
  });

  const savedUser = await userRepository.save(user);

  // Create user stats
  const userStats = userStatsRepository.create({
    userId: savedUser.id,
    maxHp: 100,
    currentHp: 100,
    attack: 20,
    defense: 10,
    strength: 15,
    vitality: 12,
    intelligence: 8,
    dexterity: 10,
    luck: 5,
    accuracy: 85,
    critRate: 5,
    critDamage: 150,
    comboRate: 10,
    counterRate: 5,
  });

  await userStatsRepository.save(userStats);

  // Create user stamina
  const userStamina = userStaminaRepository.create({
    userId: savedUser.id,
    currentStamina: 50,
    maxStamina: 100,
    lastRegenTime: new Date(),
  });

  await userStaminaRepository.save(userStamina);

  // Create sample levels if they don't exist
  const existingLevels = await levelRepository.count();
  if (existingLevels === 0) {
    for (let i = 1; i <= 10; i++) {
      const level = levelRepository.create({
        level: i,
        experienceRequired: i * 100,
        maxHp: 100 + (i - 1) * 10,
        maxMp: 50 + (i - 1) * 5,
        attack: 10 + (i - 1) * 2,
        defense: 5 + (i - 1) * 1,
        speed: 8 + (i - 1) * 1,
      });
      await levelRepository.save(level);
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const dataSource = app.get(DataSource);

  try {
    await createSampleUser(dataSource);
  } catch (error) {
    console.error('Sample user creation failed:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
