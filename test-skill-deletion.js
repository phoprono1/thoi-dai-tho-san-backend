// Test script để kiểm tra việc xóa skill và player skill
const { Pool } = require('pg');

// Database config (cập nhật theo config của bạn)
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'thoi_dai_tho_san',
  user: 'postgres',
  password: 'your_password',
});

async function testSkillDeletion() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Testing skill deletion process...\n');
    
    // 1. Check current skills and player skills
    console.log('📋 Current skill definitions:');
    const skills = await client.query('SELECT id, "skillId", name, "isActive" FROM skill_definitions ORDER BY id');
    console.table(skills.rows);
    
    console.log('\n👥 Current player skills:');
    const playerSkills = await client.query(`
      SELECT ps.id, ps."userId", ps."skillDefinitionId", sd."skillId", sd.name 
      FROM player_skills ps
      JOIN skill_definitions sd ON ps."skillDefinitionId" = sd.id
      ORDER BY ps.id
    `);
    console.table(playerSkills.rows);
    
    if (skills.rows.length === 0) {
      console.log('❌ No skills found. Please create a skill first to test deletion.');
      return;
    }
    
    if (playerSkills.rows.length === 0) {
      console.log('❌ No player skills found. Please assign a skill to a player first to test deletion.');
      return;
    }
    
    // 2. Simulate deletion of first skill
    const firstSkill = skills.rows[0];
    console.log(`\n🗑️ Simulating deletion of skill: ${firstSkill.name} (${firstSkill.skillId})`);
    
    // Count player skills before deletion
    const beforeCount = await client.query(
      'SELECT COUNT(*) FROM player_skills WHERE "skillDefinitionId" = $1',
      [firstSkill.id]
    );
    console.log(`📊 Player skills with this skill before: ${beforeCount.rows[0].count}`);
    
    // This would be the deletion logic (commented out for safety)
    /*
    // Delete player skills first
    const deletedPlayerSkills = await client.query(
      'DELETE FROM player_skills WHERE "skillDefinitionId" = $1 RETURNING *',
      [firstSkill.id]
    );
    console.log(`🗑️ Deleted ${deletedPlayerSkills.rows.length} player skills`);
    
    // Then soft delete skill definition
    await client.query(
      'UPDATE skill_definitions SET "isActive" = false WHERE id = $1',
      [firstSkill.id]
    );
    console.log(`✅ Soft deleted skill definition: ${firstSkill.name}`);
    */
    
    console.log('\n⚠️ This is a dry run. To actually test deletion, uncomment the deletion code above.');
    console.log('✨ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testSkillDeletion().catch(console.error);