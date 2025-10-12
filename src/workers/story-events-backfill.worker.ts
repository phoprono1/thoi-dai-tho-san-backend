/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import 'reflect-metadata';
import { Worker } from 'bullmq';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { StoryEventsService } from '../story-events/story-events.service';

async function bootstrapWorker() {
  const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };

  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const svc = appContext.get(StoryEventsService);

  const worker = new Worker(
    'story-events-backfill',
    async (job) => {
      const data = job.data as
        | { eventId?: number; batchSize?: number }
        | undefined;
      const eventId = Number(data?.eventId || 0) || 0;
      const batchSize = Number(data?.batchSize || 200) || 200;

      if (!eventId) throw new Error('eventId required');

      // Run the backfill using service
      const res = await svc.runBackfillForEvent(eventId, { batchSize });
      return res;
    },
    { connection },
  );

  worker.on('completed', (job) => {
    console.log(
      'Story events backfill completed',
      job.id,
      (job as any).returnvalue,
    );
  });

  worker.on('failed', (job, err) => {
    console.error(
      'Story events backfill failed',
      job?.id,
      (err as any)?.message || err,
    );
  });

  console.log('Story events backfill worker started');
}

bootstrapWorker().catch((err) => {
  console.error('Story events backfill worker bootstrap failed', err);
  process.exit(1);
});
