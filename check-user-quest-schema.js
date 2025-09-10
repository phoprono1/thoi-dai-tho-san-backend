const { Client } = require('pg');

async function checkUserQuestSchema() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'hoangpho',
    database: 'thoi_dai_tho_san'
  });

  try {
    await client.connect();

    const schema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_quests'
      ORDER BY ordinal_position
    `);

    const userQuests = await client.query('SELECT * FROM user_quests LIMIT 5');

  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkUserQuestSchema();
