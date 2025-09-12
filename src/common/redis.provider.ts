import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    const client = new Redis(url);
    client.on('error', (err) => console.error('Redis error', err));
    return client;
  },
};
