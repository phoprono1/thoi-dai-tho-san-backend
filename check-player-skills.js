require('dotenv').config();
const { DataSource } = require('typeorm');

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

ds.initialize().then(async () => {
  console.log('✅ Connected to database\n');

  // Check table structure first
  const columns = await ds.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'player_skills'
  `);
  console.log('player_skills columns:', columns.map(c => c.column_name));

  // Check player skills
  const playerSkills = await ds.query(`
    SELECT * 
    FROM player_skills 
    WHERE "userId" = 4
  `);
  
  console.log(`📊 User 4 has ${playerSkills.length} skills:`);
  console.log(JSON.stringify(playerSkills, null, 2));

  // Check skill definitions for these skills
  const skillDefIds = playerSkills.map(ps => ps.skillDefinitionId);
  const skillDefs = await ds.query(`
    SELECT id, "skillId", name, "skillType", "manaCost", "damageFormula"
    FROM skill_definitions 
    WHERE id = ANY($1)
  `, [skillDefIds]);
  console.log('\n📚 Skill definitions for user:');
  console.log(JSON.stringify(skillDefs, null, 2));

  await ds.destroy();
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
