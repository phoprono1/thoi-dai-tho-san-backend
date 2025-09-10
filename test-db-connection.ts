import { createConnection } from 'typeorm';
import * as path from 'path';

async function testConnection() {
  try {
    const connection = await createConnection({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'hoangpho',
      database: process.env.DB_DATABASE || 'thoi_dai_tho_san',
    });

    console.log('Database connection successful!');
    await connection.close();
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }
}

testConnection();
