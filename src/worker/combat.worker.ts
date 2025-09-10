/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import 'reflect-metadata';
import { Worker, Queue, QueueScheduler, Job } from 'bullmq';
import IORedis from 'ioredis';
import { AppDataSource } from '../data-source';

// Lightweight import of services used by the original combat logic.
// To avoid circular NestJS bootstrap we will re-use lower-level repositories
import { CombatResult } from '../combat-results/combat-result.entity';
import { In } from 'typeorm';
import { CombatLog } from '../combat-results/combat-log.entity';
import { User } from '../users/user.entity';
import { Dungeon } from '../dungeons/dungeon.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import { Monster } from '../monsters/monster.entity';

const connection = new IORedis(
  process.env.REDIS_URL || 'redis://127.0.0.1:6379',
);
const queueName = 'combat';

// Ensure DB connection
async function ensureDb() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
}

// Publish results to Redis channel so gateways can forward to sockets
async function publishResult(channel: string, payload: any) {
  try {
    await connection.publish(channel, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to publish combat result:', err);
  }
}

// Minimal combat processing - reuses logic from existing service but simplified and synchronous here
async function processCombat(job: Job) {
  const { roomId, userIds, dungeonId } = job.data as {
    roomId: number;
    userIds: number[];
    dungeonId: number;
  };

  await ensureDb();
  const userRepo = AppDataSource.getRepository(User);
  const dungeonRepo = AppDataSource.getRepository(Dungeon);
  const userStatRepo = AppDataSource.getRepository(UserStat);
  const monsterRepo = AppDataSource.getRepository(Monster);
  const combatResultRepo = AppDataSource.getRepository(CombatResult);
  const combatLogRepo = AppDataSource.getRepository(CombatLog);

  const startTime = Date.now();

  const users = await userRepo.findBy({ id: In(userIds) });
  const dungeon = await dungeonRepo.findOne({ where: { id: dungeonId } });

  // Basic validation (mirror earlier checks)
  if (users.length !== userIds.length || !dungeon) {
    throw new Error('Invalid users or dungeon');
  }

  // Simple combat: for demo we randomize victory/defeat quickly to avoid heavy CPU
  const victory = Math.random() > 0.3;
  const logs = [
    {
      turn: 1,
      actionOrder: 1,
      action: 'auto-sim',
      userId: userIds[0] || null,
      details: { description: victory ? 'Quick victory' : 'Tough loss' },
    },
  ];

  const duration = Date.now() - startTime;

  const result = await combatResultRepo.save({
    userIds,
    dungeonId,
    result: victory ? 'victory' : 'defeat',
    duration,
    rewards: victory ? { experience: 10 } : { experience: 1 },
    teamStats: {
      members: users.map((u) => ({ userId: u.id, username: u.username })),
    },
    logs,
  } as any);

  // publish to Redis channel for the room
  await publishResult(`combat:room:${roomId}`, {
    success: true,
    combatResultId: result.id,
    combat: { result: result.result, duration, logs },
  });

  return result;
}

async function startWorker() {
  const scheduler = new QueueScheduler(queueName, { connection });
  await scheduler.waitUntilReady();

  const worker = new Worker(
    queueName,
    async (job) => {
      return processCombat(job);
    },
    {
      connection,
      concurrency: Number(process.env.COMBAT_WORKER_CONCURRENCY || 1),
    },
  );

  worker.on('completed', (job) => {
    console.log('Combat job completed', job.id);
  });
  worker.on('failed', (job, err) => {
    console.error('Combat job failed', job?.id, err);
  });

  console.log('Combat worker started, queue=', queueName);
}

startWorker().catch((err) => {
  console.error('Worker failed to start', err);
  process.exit(1);
});
