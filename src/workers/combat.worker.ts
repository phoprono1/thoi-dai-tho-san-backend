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
      const data = job.data as any;
      const { roomId } = data;

      // Determine participant list from job payload
      const userIds = data.userIds || (data.userId ? [data.userId] : []);

      // If job includes explicit enemy templates (wild area), call new helper
      if (Array.isArray(data.enemies) && data.enemies.length > 0) {
        // call new service method to run combat with provided enemies
        const result = await (combatService as any).startCombatWithEnemies(
          userIds,
          data.enemies,
          { source: data.source || 'wildarea' },
        );

        await redisPub.publish(
          'combat:result',
          JSON.stringify({ roomId, jobId: job.id, result }),
        );
        return result;
      }

      // Fallback: existing dungeon flow
      const dungeonId = data.dungeonId || 1;

      try {
        const result = await combatService.startCombat(userIds, dungeonId);

        // publish success result to redis channel
        await redisPub.publish(
          'combat:result',
          JSON.stringify({ roomId, jobId: job.id, result }),
        );

        return result;
      } catch (error) {
        // Handle combat errors (like missing items) and send to frontend
        console.log(
          `[COMBAT WORKER] Combat failed for room ${roomId}:`,
          error.message,
        );

        // Publish error to frontend via WebSocket
        await redisPub.publish(
          'combat:error',
          JSON.stringify({
            roomId,
            jobId: job.id,
            error: {
              message: error.message,
              type: 'COMBAT_REQUIREMENT_ERROR',
            },
          }),
        );

        // Re-throw to mark job as failed
        throw error;
      }
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
