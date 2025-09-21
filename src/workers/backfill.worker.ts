/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import 'reflect-metadata';
import { Worker } from 'bullmq';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserStatsService } from '../user-stats/user-stats.service';

async function bootstrapWorker() {
  const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };

  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const userStatsService = appContext.get(UserStatsService);

  const worker = new Worker(
    'admin-backfill',
    async (job) => {
      const data = job.data as { batchSize?: number } | undefined;
      const batchSize = data?.batchSize ?? 200;

      const all = await userStatsService.findAll();
      const ids = all.map((s) => s.userId).filter(Boolean);

      let processed = 0;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        for (const uid of batch) {
          try {
            await userStatsService.recomputeAndPersistForUser(uid);
            processed++;
          } catch (err: unknown) {
            console.error(
              'Backfill user failed',
              uid,
              (err as any)?.message || err,
            );
          }
        }
      }

      return { processed };
    },
    { connection },
  );

  worker.on('completed', (job) => {
    console.log('Backfill job completed', job.id, (job as any).returnvalue);
  });

  worker.on('failed', (job, err) => {
    console.error('Backfill job failed', job?.id, (err as any)?.message || err);
  });

  console.log('Backfill worker started');
}

bootstrapWorker().catch((err) => {
  console.error('Backfill worker bootstrap failed', err);
  process.exit(1);
});
