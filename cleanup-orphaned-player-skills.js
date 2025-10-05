// Cleanup script để xóa orphaned player skills
// Run: node cleanup-orphaned-player-skills.js

const { Pool } = require('pg');

// Database config (cập nhật theo config của bạn)
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'thoi_dai_tho_san',
  user: 'postgres',
  password: 'your_password',
});

async function cleanupOrphanedPlayerSkills() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Starting cleanup of orphaned player skills...\n');
    
    // 1. Find orphaned player skills (skills that reference inactive skill definitions)
    console.log('1️⃣ Finding orphaned player skills...');
    const orphanedSkills = await client.query(`
      SELECT 
        ps.id as player_skill_id,
        ps."userId",
        ps."skillDefinitionId",
        sd."skillId",
        sd.name,
        sd."isActive"
      FROM player_skills ps
      JOIN skill_definitions sd ON ps."skillDefinitionId" = sd.id
      WHERE sd."isActive" = false
      ORDER BY ps.id
    `);
    
    console.log(`📊 Found ${orphanedSkills.rows.length} orphaned player skills:`);
    if (orphanedSkills.rows.length > 0) {
      console.table(orphanedSkills.rows);
    }
    
    // 2. Find completely missing skill definitions (should not happen with foreign keys)
    console.log('\n2️⃣ Checking for player skills with missing skill definitions...');
    const missingSkills = await client.query(`
      SELECT 
        ps.id as player_skill_id,
        ps."userId",
        ps."skillDefinitionId"
      FROM player_skills ps
      LEFT JOIN skill_definitions sd ON ps."skillDefinitionId" = sd.id
      WHERE sd.id IS NULL
      ORDER BY ps.id
    `);
    
    console.log(`📊 Found ${missingSkills.rows.length} player skills with missing definitions:`);
    if (missingSkills.rows.length > 0) {
      console.table(missingSkills.rows);
    }
    
    // 3. Calculate total cleanup needed
    const totalOrphaned = orphanedSkills.rows.length + missingSkills.rows.length;
    
    if (totalOrphaned === 0) {
      console.log('\n✅ No orphaned player skills found. Database is clean!');
      return;
    }
    
    console.log(`\n🧹 Total orphaned player skills to clean: ${totalOrphaned}`);
    
    // 4. Dry run - show what would be deleted
    console.log('\n📋 DRY RUN - Following player skills would be deleted:');
    
    if (orphanedSkills.rows.length > 0) {
      console.log('\n   🗑️ Skills referencing inactive skill definitions:');
      orphanedSkills.rows.forEach(row => {
        console.log(`      - Player ${row.userId}: ${row.name} (${row.skillId})`);
      });
    }
    
    if (missingSkills.rows.length > 0) {
      console.log('\n   🗑️ Skills with missing skill definitions:');
      missingSkills.rows.forEach(row => {
        console.log(`      - Player ${row.userId}: Unknown skill (ID: ${row.skillDefinitionId})`);
      });
    }
    
    // 5. Optional: Actual cleanup (uncomment to execute)
    /*
    console.log('\n🗑️ Executing cleanup...');
    
    // Delete orphaned skills (inactive skill definitions)
    if (orphanedSkills.rows.length > 0) {
      const deleteInactive = await client.query(`
        DELETE FROM player_skills 
        WHERE "skillDefinitionId" IN (
          SELECT sd.id FROM skill_definitions sd WHERE sd."isActive" = false
        )
        RETURNING id, "userId", "skillDefinitionId"
      `);
      console.log(`✅ Deleted ${deleteInactive.rows.length} player skills referencing inactive definitions`);
    }
    
    // Delete skills with missing definitions
    if (missingSkills.rows.length > 0) {
      const deleteMissing = await client.query(`
        DELETE FROM player_skills ps
        WHERE NOT EXISTS (
          SELECT 1 FROM skill_definitions sd WHERE sd.id = ps."skillDefinitionId"
        )
        RETURNING id, "userId", "skillDefinitionId"
      `);
      console.log(`✅ Deleted ${deleteMissing.rows.length} player skills with missing definitions`);
    }
    */
    
    console.log('\n⚠️ This is a DRY RUN. To actually clean up orphaned skills:');
    console.log('   1. Backup your database first!');
    console.log('   2. Uncomment the cleanup code in this script');
    console.log('   3. Run the script again');
    console.log('\n✨ Cleanup analysis completed!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Add safety confirmation
console.log('🔒 ORPHANED PLAYER SKILLS CLEANUP');
console.log('=====================================');
console.log('This script will analyze and optionally clean up orphaned player skills.');
console.log('Make sure to backup your database before running the actual cleanup!');
console.log('');

// Run the cleanup
cleanupOrphanedPlayerSkills().catch(console.error);