// Script to populate level data with attribute points rewards
// Run this after implementing the free attribute points system

import { DataSource } from 'typeorm';
import { Level } from '../src/levels/level.entity';

async function populateLevelAttributePoints() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'hoangpho',
    database: process.env.DB_DATABASE || 'thoi_dai_tho_san_v2',
    entities: [Level],
    synchronize: true, // For development
  });

  await dataSource.initialize();

  console.log('🔄 Populating level attribute points rewards...');

  // Update all levels with attribute points rewards
  for (let level = 1; level <= 100; level++) {
    // 3-6 points per level based on level range
    const pointsReward = Math.min(6, Math.floor(level / 10) + 3);

    await dataSource.manager.update(
      Level,
      { level },
      { attributePointsReward: pointsReward }
    );

    if (level <= 10 || level % 10 === 0) {
      console.log(`Level ${level}: ${pointsReward} attribute points`);
    }
  }

  console.log('✅ Level attribute points populated successfully!');
  await dataSource.destroy();
}

// Run if executed directly
if (require.main === module) {
  populateLevelAttributePoints().catch(console.error);
}

export { populateLevelAttributePoints };