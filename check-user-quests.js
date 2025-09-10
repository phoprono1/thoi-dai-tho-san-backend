const { Client } = require('pg');

async function checkUserQuests() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'hoangpho',
    database: 'thoi_dai_tho_san'
  });

  try {
    await client.connect();

    const userQuests = await client.query(`
      SELECT uq."userId", uq."questId", uq.status, uq.progress, uq."createdAt",
             q.name as quest_name, q.type as quest_type
      FROM user_quests uq
      JOIN quests q ON uq."questId" = q.id
      ORDER BY uq."userId", uq."createdAt"
    `);

    if (userQuests.rows.length === 0) {
      // Check if there are any users
      const users = await client.query('SELECT id, username FROM "user" LIMIT 5');
    }

  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkUserQuests();
