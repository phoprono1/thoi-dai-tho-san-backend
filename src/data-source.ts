import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';

// Parse DATABASE_URL if available
let dbConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'hoangpho',
  database: process.env.DB_DATABASE || 'thoi_dai_tho_san',
};

// If DATABASE_URL is provided (like from Neon), use it instead
if (process.env.DATABASE_URL) {
  dbConfig = {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  };
}

export const AppDataSource = new DataSource({
  ...dbConfig,
  entities: [path.resolve(__dirname, '**/*.entity{.ts,.js}')],
  migrations: [path.resolve(__dirname, 'migrations/*{.ts,.js}')],
  // Only enable synchronize when explicitly requested via env var to avoid
  // accidental schema changes at runtime. Default: false.
  synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
  // Control whether migrations should run automatically via env var. In
  // production we prefer explicit migration runs (the start script already
  // runs migrations), but some deployments may set MIGRATIONS_RUN=true.
  migrationsRun: process.env.MIGRATIONS_RUN === 'true',
  // Disable verbose SQL logging by default. Set TYPEORM_LOGGING=true to enable.
  logging: process.env.TYPEORM_LOGGING === 'true',
});
