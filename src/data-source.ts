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
  synchronize: process.env.NODE_ENV === 'development', // Auto-sync in development only
  logging: process.env.NODE_ENV === 'development',
});
