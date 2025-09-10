const { Client } = require('pg');

// Database connection
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'thoi_dai_tho_san',
  user: 'postgres',
  password: '123456',
});

async function testAutoAssignQuest() {
  try {
    await client.connect();

    // Get current user count
    const userCountResult = await client.query('SELECT COUNT(*) as count FROM "user"');
    const userCount = parseInt(userCountResult.rows[0].count);

    // Create a test quest
    const questData = {
      name: 'Test Auto Assign Quest',
      description: 'This quest should be auto-assigned to all users',
      type: 'side',
      requiredLevel: 1,
      requirements: JSON.stringify({
        killEnemies: [{ enemyType: 'goblin', count: 5 }]
      }),
      rewards: JSON.stringify({
        experience: 100,
        gold: 50
      }),
      dependencies: JSON.stringify({}),
      isActive: true,
      isRepeatable: false
    };

    const questResult = await client.query(`
      INSERT INTO quests (name, description, type, "requiredLevel", requirements, rewards, dependencies, "isActive", "isRepeatable", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING id
    `, [
      questData.name,
      questData.description,
      questData.type,
      questData.requiredLevel,
      questData.requirements,
      questData.rewards,
      questData.dependencies,
      questData.isActive,
      questData.isRepeatable
    ]);

    const questId = questResult.rows[0].id;

    // Check if user_quests were created
    const userQuestResult = await client.query(`
      SELECT COUNT(*) as count FROM user_quests WHERE "questId" = $1
    `, [questId]);

    const userQuestCount = parseInt(userQuestResult.rows[0].count);

    if (userQuestCount === userCount) {
      // Success
    } else {
      // Test failed
    }

    // Show sample user quests
    const sampleResult = await client.query(`
      SELECT u.username, uq.status, uq."createdAt"
      FROM user_quests uq
      JOIN "user" u ON uq."userId" = u.id
      WHERE uq."questId" = $1
      LIMIT 5
    `, [questId]);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

testAutoAssignQuest();
