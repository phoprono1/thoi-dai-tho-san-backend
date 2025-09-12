const { AppDataSource } = require('./dist/src/data-source.js');

async function runMigrations() {
  try {
    console.log('🔄 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Connected to database');
    
    console.log('🔄 Running migrations...');
    await AppDataSource.runMigrations();
    console.log('✅ Migrations completed successfully');
    
    console.log('🔄 Closing database connection...');
    await AppDataSource.destroy();
    console.log('✅ Database connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();