const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'thoi_dai_tho_san_v2',
  user: 'postgres',
  password: 'hoangpho'
});

const petTables = [
  'pet_banners',
  'pet_definitions', 
  'pet_equipment',
  'pet_evolutions',
  'user_pets',
  'user_pet_banner_pity',
  'pet_gacha_pulls'
];

async function checkSchemas() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    for (const table of petTables) {
      const result = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [table]);

      console.log(`📊 ${table}:`);
      console.log('='.repeat(60));
      result.rows.forEach(row => {
        console.log(`  ${row.column_name.padEnd(30)} | ${row.data_type}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchemas();
