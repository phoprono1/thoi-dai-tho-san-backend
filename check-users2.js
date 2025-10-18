const { Client } = require('pg');

async function checkUsers() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'hoangpho',
    database: 'thoi_dai_tho_san_v2'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check table structure
    const tableInfo = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user'
      ORDER BY ordinal_position
    `);
    console.log('Users table columns:', tableInfo.rows);

    const result = await client.query('SELECT "id", "username", "isAdmin" FROM users LIMIT 5');
    console.log('Users:', result.rows);

    await client.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUsers();