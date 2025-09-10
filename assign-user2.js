import pkg from 'pg';
const { Client } = pkg;

async function assignQuestsForUser2() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'hoangpho',
    database: 'thoi_dai_tho_san'
  });

  try {
    await client.connect();

    const userId = 2; // User hiện tại

    // Kiểm tra user có tồn tại không
    const userCheck = await client.query('SELECT id, username FROM "user" WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      throw new Error(`User ID ${userId} không tồn tại`);
    }

    // Lấy tất cả quests active
    const quests = await client.query('SELECT id, name, type FROM quests WHERE "isActive" = true ORDER BY id');

    // Kiểm tra quests đã assign
    const existingQuests = await client.query(
      'SELECT "questId" FROM user_quests WHERE "userId" = $1',
      [userId]
    );

    const existingQuestIds = existingQuests.rows.map(row => row.questId);

    // Assign quests chưa có
    let assignedCount = 0;
    for (const quest of quests.rows) {
      if (!existingQuestIds.includes(quest.id)) {
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
        assignedCount++;
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

assignQuestsForUser2();
