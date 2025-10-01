const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const skillService = app.get('SkillService');

  console.log('🔍 Testing getPlayerSkills for user 4...\n');
  
  const skills = await skillService.getPlayerSkills(4);
  
  console.log(`Total skills: ${skills.length}`);
  console.log('\nSkills details:');
  
  skills.forEach((ps, idx) => {
    console.log(`\n${idx + 1}. PlayerSkill ID: ${ps.id}`);
    console.log(`   Level: ${ps.level}, Equipped: ${ps.isEquipped}`);
    if (ps.skillDefinition) {
      console.log(`   SkillDefinition: ${ps.skillDefinition.name} (${ps.skillDefinition.skillType})`);
      console.log(`   Mana Cost: ${ps.skillDefinition.manaCost}`);
      console.log(`   Damage Formula: ${ps.skillDefinition.damageFormula}`);
    } else {
      console.log('   ⚠️ NO SKILL DEFINITION!');
    }
  });
  
  await app.close();
}

bootstrap().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
