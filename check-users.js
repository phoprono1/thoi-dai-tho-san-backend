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

    const result = await client.query('SELECT id, username, is_admin FROM user LIMIT 10');
    console.log('Users:', result.rows);

    await client.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUsers();