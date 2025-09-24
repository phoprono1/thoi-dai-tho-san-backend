import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SkillDefinitionService } from '../src/player-skills/skill-definition.service';
import * as baseSkills from './base-skills.js';

async function seedBaseSkills() {
  console.log('🌱 Seeding base skills...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const skillDefinitionService = app.get(SkillDefinitionService);

  let successCount = 0;
  let errorCount = 0;

  for (const skillData of baseSkills) {
    try {
      console.log(`Creating skill: ${skillData.name} (${skillData.skillId})`);
      await skillDefinitionService.createSkillDefinition(skillData);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to create skill ${skillData.skillId}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n✅ Seeding completed!`);
  console.log(`📊 Success: ${successCount} skills created`);
  console.log(`❌ Errors: ${errorCount} skills failed`);

  await app.close();
  process.exit(errorCount > 0 ? 1 : 0);
}

seedBaseSkills().catch(console.error);