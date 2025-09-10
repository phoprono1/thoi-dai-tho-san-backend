import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { seedCharacterClasses } from './src/character-classes/seed-character-classes';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const dataSource = app.get(DataSource);

  try {
    await seedCharacterClasses(dataSource);
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
