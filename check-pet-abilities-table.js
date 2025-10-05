const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'your_database',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function checkTableStructure() {
  try {
    console.log('Checking pet_abilities table structure...\n');
    
    const result = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'pet_abilities'
      ORDER BY ordinal_position;
    `);
    
    console.log('Columns in pet_abilities table:');
    console.table(result.rows);
    
    const dataResult = await pool.query('SELECT * FROM pet_abilities LIMIT 3');
    console.log('\nSample data:');
    console.table(dataResult.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTableStructure();
