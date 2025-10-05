const { DataSource } = require('typeorm');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'hoangpho',
  database: process.env.DB_NAME || 'thoi_dai_tho_san_v2',
  synchronize: false,
});

async function checkBanners() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Connected to database');

    // Check for banners
    const bannerResult = await AppDataSource.query(
      'SELECT id, name, "bannerType", "isActive", "startDate", "endDate", "featuredPets" FROM pet_banners ORDER BY id'
    );

    console.log(`\n📊 Found ${bannerResult.length} banner(s):`);
    bannerResult.forEach((banner) => {
      const now = new Date();
      const startDate = new Date(banner.startDate);
      const endDate = new Date(banner.endDate);
      const isCurrentlyActive = banner.isActive && startDate <= now && endDate >= now;
      
      console.log(`\n  Banner ID: ${banner.id}`);
      console.log(`  Name: ${banner.name}`);
      console.log(`  Type: ${banner.bannerType}`);
      console.log(`  Is Active: ${banner.isActive}`);
      console.log(`  Start Date: ${startDate.toISOString()}`);
      console.log(`  End Date: ${endDate.toISOString()}`);
      console.log(`  Currently Active: ${isCurrentlyActive ? '✅ YES' : '❌ NO'}`);
      console.log(`  Featured Pets:`, JSON.stringify(banner.featuredPets, null, 2));
    });

    // Check for pet definitions
    const petResult = await AppDataSource.query(
      'SELECT COUNT(*) as count FROM pet_definitions'
    );
    console.log(`\n📊 Found ${petResult[0].count} pet definition(s)`);

    // Check for gacha pulls
    const pullResult = await AppDataSource.query(
      'SELECT COUNT(*) as count FROM pet_gacha_pulls'
    );
    console.log(`📊 Found ${pullResult[0].count} gacha pull(s)`);

    await AppDataSource.destroy();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkBanners();
