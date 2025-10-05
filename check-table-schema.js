const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'thoi_dai_tho_san_v2',
  user: 'postgres',
  password: 'hoangpho'
});

async function checkSchema() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check pet_gacha_pulls table structure
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'pet_gacha_pulls' 
      ORDER BY ordinal_position
    `);

    console.log('📊 Columns in pet_gacha_pulls table:');
    console.log('='.repeat(80));
    result.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(20)} | ${row.data_type.padEnd(25)} | Nullable: ${row.is_nullable}`);
    });
    console.log('='.repeat(80));
    console.log(`\n✅ Total columns: ${result.rows.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema();
