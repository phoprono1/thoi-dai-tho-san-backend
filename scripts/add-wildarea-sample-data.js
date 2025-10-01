const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'thoi_dai_tho_san_v2',
  user: 'postgres',
  password: 'hoangpho',
});

async function addSampleWildAreaData() {
  try {
    await client.connect();
    
    // First check the table structure
    const structureResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'wildarea_monsters'
    `);
    console.log('Table structure:');
    console.table(structureResult.rows);
    
    // Clear existing wildarea data
    await client.query('DELETE FROM wildarea_monsters');
    
    // Add sample wildarea monsters using correct column names
    const sampleData = [
      { monsterId: 1, minLevel: 1, maxLevel: 5, spawnWeight: 3.0, description: 'Common early-game monster' },
      { monsterId: 5, minLevel: 1, maxLevel: 3, spawnWeight: 2.5, description: 'Starter area goblin' },
      { monsterId: 2, minLevel: 2, maxLevel: 8, spawnWeight: 2.8, description: 'Forest predator' },
      { monsterId: 3, minLevel: 3, maxLevel: 10, spawnWeight: 1.5, description: 'Rare stone creature' },
      { monsterId: 4, minLevel: 4, maxLevel: 12, spawnWeight: 1.2, description: 'Elemental creature' },
      { monsterId: 6, minLevel: 20, maxLevel: 30, spawnWeight: 2.0, description: 'Mid-level slime' }
    ];
    
    for (const data of sampleData) {
      await client.query(
        `INSERT INTO wildarea_monsters ("monsterId", "minLevel", "maxLevel", "spawnWeight", description, "isActive", "createdAt", "updatedAt") 
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
        [data.monsterId, data.minLevel, data.maxLevel, data.spawnWeight, data.description]
      );
    }
    
    console.log('Sample wildarea data added successfully!');
    
    // Verify the data
    const result = await client.query(`
      SELECT wa.*, m.name as monster_name, m.level as monster_level 
      FROM wildarea_monsters wa 
      JOIN monsters m ON wa."monsterId" = m.id 
      ORDER BY wa."minLevel"
    `);
    console.log('Current wildarea monsters:');
    console.table(result.rows);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

addSampleWildAreaData();