import pkg from 'pg';
const { Client } = pkg;

async function assignMoreQuests() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'hoangpho',
    database: 'thoi_dai_tho_san'
  });

  try {
    await client.connect();

    const userId = 1; // testuser

    // Get all quests except the one already assigned
    const quests = await client.query(
      'SELECT id, name, type FROM quests WHERE "isActive" = true AND id != 1 LIMIT 3'
    );

    for (const quest of quests.rows) {
      // Check if user already has this quest
      const existing = await client.query(
        'SELECT id FROM user_quests WHERE "userId" = $1 AND "questId" = $2',
        [userId, quest.id]
      );

      if (existing.rows.length === 0) {
        // Assign quest
        await client.query(
          'INSERT INTO user_quests ("userId", "questId", status, progress, "startedAt", "createdAt", "updatedAt", "completionCount") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [
            userId,
            quest.id,
            'available',
            JSON.stringify({}),
            new Date(),
            new Date(),
            new Date(),
            0
          ]
        );
      } else {
        // Already has quest
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

assignMoreQuests();
