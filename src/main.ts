/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';

// Import worker startup
async function startCombatWorker() {
  try {
    const { Worker } = await import('bullmq');
    const Redis = (await import('ioredis')).default;
    const { CombatResultsService } = await import(
      './combat-results/combat-results.service'
    );

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

        console.log(
          `Processing combat job for room ${roomId}, users: ${userIds}, dungeon: ${data.dungeonId}`,
        );

        try {
          // If job includes explicit enemy templates (wild area), call new helper
          if (Array.isArray(data.enemies) && data.enemies.length > 0) {
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
          const result = await combatService.startCombat(userIds, dungeonId);

          // Publish result to Redis
          await redisPub.publish(
            'combat:result',
            JSON.stringify({ roomId, jobId: job.id, result }),
          );
          return result;
        } catch (error) {
          console.error('Combat processing error:', error);
          throw error;
        }
      },
      { connection },
    );

    worker.on('completed', (job) => {
      console.log(`Combat job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`Combat job ${job?.id} failed:`, err);
    });

    console.log('Combat worker started successfully');
  } catch (error) {
    console.error('Failed to start combat worker:', error);
  }
}

async function bootstrap() {
  // Global diagnostics: log uncaught errors and process exit to help debugging
  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION', reason);
  });

  process.on('exit', (code) => {
    console.log('process.exit event, code=', code);
  });

  // Ensure backend/assets directories exist on startup. When deploying to a VPS
  // it's common to not commit large binary assets to git; create the folders
  // automatically so ServeStatic has something to serve and uploads can write
  // files without failing.
  try {
    const fs = await import('fs');
    const path = await import('path');
    const root = path.join(__dirname, '..', 'assets');
    const subdirs = ['monsters', 'dungeons', 'items'];
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
      // create a simple README so the folder is self-describing if someone
      // inspects the VPS filesystem.
      try {
        fs.writeFileSync(
          path.join(root, 'README.md'),
          '# Assets\n\nPlace monster, dungeon, and item images in the corresponding subfolders: monsters/, dungeons/, items/\n',
        );
      } catch (e) {
        // ignore write failures
      }
    }
    for (const d of subdirs) {
      const p = path.join(root, d);
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    }
  } catch (err) {
    // Do not crash the app if we cannot create folders; log and continue.
    // This avoids startup failure on read-only filesystems while still
    // attempting to provide the convenience for normal VPS deployments.
    console.warn('Could not create assets directories at startup:', err);
  }

  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.setGlobalPrefix('api');

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('Thời Đại Thợ Săn API')
    .setDescription('API documentation cho game Thời Đại Thợ Săn')
    .setVersion('1.0')
    .addTag('users', 'Quản lý người dùng')
    .addTag('auth', 'Xác thực và đăng nhập')
    .addTag('classes', 'Hệ thống class và kỹ năng')
    .addTag('combat', 'Hệ thống chiến đấu')
    .addTag('items', 'Quản lý vật phẩm')
    .addTag('dungeons', 'Quản lý dungeon')
    .addTag('user-stamina', 'Quản lý stamina')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  // Configure Socket.IO Redis adapter for cross-instance pub/sub
  // create io after http server is available
  const server = await app.listen(process.env.PORT ?? 3005);

  // declare clients in outer scope so we can close them on shutdown
  let pubClient: RedisClientType | null = null;
  let subClient: RedisClientType | null = null;

  // Delay setup to allow WebSocket gateways to initialize
  setTimeout(async () => {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
      pubClient = createClient({ url: redisUrl });
      subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);

      // Try to find the existing Socket.IO server that Nest created for gateways.
      // Do NOT call require('socket.io')(server) because that creates a second
      // engine.io instance on the same HTTP server and causes handleUpgrade() to
      // be called twice (see runtime error). Instead attach the redis adapter
      // to the already-created io server when available.
      let io: any = null;
      try {
        const wsAdapter =
          (app as any).getWebSocketAdapter &&
          (app as any).getWebSocketAdapter();
        if (wsAdapter && typeof wsAdapter.getServer === 'function') {
          io = wsAdapter.getServer();
        }
      } catch (e) {
        // ignore
      }

      const httpServer = app.getHttpServer();
      if (!io) {
        io =
          (httpServer as any).io ||
          (httpServer as any)._io ||
          (httpServer as any).server?.io ||
          null;
      }

      if (!io) {
        console.warn(
          'No existing Socket.IO server found — skipping redis adapter attach',
        );
      } else {
        io.adapter(createAdapter(pubClient, subClient));
        io.of('/api').adapter(createAdapter(pubClient, subClient));
        io.of('/rooms').adapter(createAdapter(pubClient, subClient));
        io.of('/chat').adapter(createAdapter(pubClient, subClient));
        console.log(
          'Socket.IO Redis adapter configured for /, /api, /rooms, and /chat',
        );
      }
    } catch (err) {
      console.warn('Could not configure Socket.IO Redis adapter', err);
    }
  }, 2000); // Delay 2 seconds to allow gateways to initialize

  // Graceful shutdown: disconnect redis clients when app closes
  const shutdown = async () => {
    console.log('Shutting down — closing redis clients');
    try {
      if (pubClient) await pubClient.disconnect();
    } catch (e) {
      /* ignore */
    }
    try {
      if (subClient) await subClient.disconnect();
    } catch (e) {
      /* ignore */
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  app.enableShutdownHooks();

  // Start combat worker
  await startCombatWorker();
}

void bootstrap();
