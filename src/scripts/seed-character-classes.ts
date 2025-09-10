import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { seedCharacterClasses } from '../character-classes/seed-character-classes';

async function runSeeding() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get('DATA_SOURCE'); // or however you access your DataSource
    await seedCharacterClasses(dataSource);
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await app.close();
  }
}

runSeeding();
