import pkg from 'pg';
const { Client } = pkg;

async function testAssign() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'hoangpho',
    database: 'thoi_dai_tho_san'
  });

  try {
    await client.connect();

    // Get user with ID 1
    const userResult = await client.query('SELECT id, username FROM "user" WHERE id = 1');
    if (userResult.rows.length === 0) {
      return;
    }

    const user = userResult.rows[0];

    // Get one quest
    const questResult = await client.query('SELECT id, name FROM quests WHERE "isActive" = true LIMIT 1');
    if (questResult.rows.length === 0) {
      return;
    }

    const quest = questResult.rows[0];

    // Check if user already has this quest
    const existing = await client.query(
      'SELECT id FROM user_quests WHERE "userId" = $1 AND "questId" = $2',
      [user.id, quest.id]
    );

    if (existing.rows.length > 0) {
      return;
    }

    // Assign quest
    const result = await client.query(
      'INSERT INTO user_quests ("userId", "questId", status, progress, "startedAt", "createdAt", "updatedAt", "completionCount") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [
        user.id,
        quest.id,
        'available',
        JSON.stringify({}),
        new Date(),
        new Date(),
        new Date(),
        0
      ]
    );

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testAssign();
