/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import 'reflect-metadata';
import { Worker } from 'bullmq';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import Redis from 'ioredis';
import { CombatResultsService } from '../combat-results/combat-results.service';

async function bootstrapWorker() {
  const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };

  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const combatService = appContext.get(CombatResultsService);

  const redisPub = new Redis(connection);

  const worker = new Worker(
    'combat',
    async (job) => {
      const { roomId, userId } = job.data as any;
      // Determine participant list from room info or job payload
      // For now, call startCombat with single user as demo
      // In production, job should include userIds array and dungeonId
      const userIds = job.data.userIds || [userId];
      const dungeonId = job.data.dungeonId || 1;

      const result = await combatService.startCombat(userIds, dungeonId);

      // publish to redis channel
      await redisPub.publish(
        'combat:result',
        JSON.stringify({ roomId, result }),
      );

      return result;
    },
    { connection, concurrency: 2 },
  );

  worker.on('completed', (job) => {
    console.log('Combat job completed', job.id);
  });

  worker.on('failed', (job, err) => {
    console.error('Combat job failed', job?.id, err?.message || err);
  });

  console.log('Combat worker started');
}

bootstrapWorker().catch((err) => {
  console.error('Worker bootstrap failed', err);
  process.exit(1);
});
