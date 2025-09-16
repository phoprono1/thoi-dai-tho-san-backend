const { AppDataSource } = require('./dist/src/data-source.js');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryInitialize(attempt) {
  console.log(`🔄 [attempt ${attempt}] Connecting to database...`);
  await AppDataSource.initialize();
  console.log('✅ Connected to database');
}

async function runMigrations() {
  const maxAttempts = parseInt(process.env.MIGRATION_RETRY_ATTEMPTS || '10', 10);
  const delayMs = parseInt(process.env.MIGRATION_RETRY_DELAY_MS || '2000', 10);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await tryInitialize(attempt);

      console.log('🔄 Running migrations...');
      await AppDataSource.runMigrations();
      console.log('✅ Migrations completed successfully');

      console.log('🔄 Closing database connection...');
      await AppDataSource.destroy();
      console.log('✅ Database connection closed');

      process.exit(0);
      return;
    } catch (error) {
      console.error(`❌ Migration attempt ${attempt} failed:`, error && error.message ? error.message : error);

      if (attempt < maxAttempts) {
        console.log(`⏳ Waiting ${delayMs}ms before retrying (attempt ${attempt + 1}/${maxAttempts})`);
        // Ensure the DataSource is destroyed/cleared before the next attempt if partially initialized
        try {
          if (AppDataSource && AppDataSource.isInitialized) {
            await AppDataSource.destroy();
          }
        } catch (dErr) {
          // ignore
        }
        await sleep(delayMs);
        continue;
      }

      console.error('❌ All migration attempts failed. Exiting.');
      process.exit(1);
    }
  }
}

runMigrations();