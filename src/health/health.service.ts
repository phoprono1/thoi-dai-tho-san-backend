/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../common/redis.provider';
import type Redis from 'ioredis';

@Injectable()
export class HealthService {
  constructor(
    private dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async checkDb(): Promise<boolean> {
    try {
      // simple lightweight query
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (e) {
      return false;
    }
  }

  async checkRedis(): Promise<boolean> {
    try {
      const res = await this.redisClient.ping();
      return res === 'PONG';
    } catch (e) {
      return false;
    }
  }
}
