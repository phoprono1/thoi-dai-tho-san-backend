const { Client } = require('pg');

async function checkData() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'hoangpho',
    database: 'thoi_dai_tho_san'
  });

  try {
    await client.connect();

    const users = await client.query('SELECT id, username FROM "user"');
    const quests = await client.query('SELECT id, title, type FROM quests');
    const userQuests = await client.query('SELECT user_id, quest_id, status FROM user_quests');

  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkData();
