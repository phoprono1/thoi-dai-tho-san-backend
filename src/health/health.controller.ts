import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async get() {
    const db = await this.healthService.checkDb();
    const redis = await this.healthService.checkRedis();
    return { db, redis, ok: db && redis };
  }
}
