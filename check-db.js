const { Client } = require('pg');

async function checkDB() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'hoangpho',
    database: 'postgres'
  });

  try {
    await client.connect();

    const dbs = await client.query("SELECT datname FROM pg_database WHERE datname LIKE 'thoi%'");

    // Try to connect to the specific database
    const targetClient = new Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'hoangpho',
      database: 'thoi_dai_tho_san'
    });

    await targetClient.connect();
    const tables = await targetClient.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");

    await targetClient.end();

  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkDB();
