const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  try {
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

    console.log('\n📊 Current pet_abilities table schema:\n');
    console.table(result.rows);

    // Check for unexpected columns
    const expectedColumns = [
      'id',
      'name',
      'type',
      'description',
      'effects',
      'cooldown',
      'manaCost',
      'targetType',
      'icon',
      'rarity',
      'isActive',
      'createdAt',
      'updatedAt',
    ];

    const actualColumns = result.rows.map((r) => r.column_name);
    const unexpectedColumns = actualColumns.filter(
      (col) => !expectedColumns.includes(col)
    );

    if (unexpectedColumns.length > 0) {
      console.log('\n⚠️  Unexpected columns found:');
      unexpectedColumns.forEach((col) => console.log(`  - ${col}`));
    } else {
      console.log('\n✅ No unexpected columns found');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkSchema();
