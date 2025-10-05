const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkEvolutions() {
  try {
    const result = await pool.query(`
      SELECT id, "basePetId", "evolutionStage", "statMultipliers"
      FROM pet_evolutions
      ORDER BY id
      LIMIT 5
    `);

    console.log('\n📊 Evolution stat multipliers in database:\n');
    result.rows.forEach((row) => {
      console.log(`ID: ${row.id}, Pet: ${row.basePetId}, Stage: ${row.evolutionStage}`);
      console.log('StatMultipliers:', JSON.stringify(row.statMultipliers, null, 2));
      console.log('---');
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkEvolutions();
