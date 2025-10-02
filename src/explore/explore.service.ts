/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { combatQueue } from '../queues/combat.queue';
import { WildAreaService } from '../wildarea/wildarea.service';
import { CombatResultsService } from '../combat-results/combat-results.service';
import { UserStaminaService } from '../user-stamina/user-stamina.service';

const REDIS_CONN = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

@Injectable()
export class ExploreService {
  private redis: Redis;

  constructor(
    private readonly wildAreaService: WildAreaService,
    private readonly combatResultsService: CombatResultsService,
    private readonly userStaminaService: UserStaminaService,
  ) {
    this.redis = new Redis(REDIS_CONN);
  }

  private getCooldownKey(userId: number) {
    return `wildarea:cooldown:${userId}`;
  }

  async startWildAreaRun(userId: number, preferredCount?: number) {
    let count: number;
    if (typeof preferredCount !== 'undefined' && preferredCount !== null) {
      count = Math.min(Math.max(1, Number(preferredCount) || 1), 3);
    } else {
      // Default: random 1..3 monsters
      count = Math.floor(Math.random() * 3) + 1;
    }

    // Cooldown check (10s)
    const key = this.getCooldownKey(userId);
    const exists = await this.redis.get(key);
    if (exists) throw new Error('Bạn đang cooldown, hãy chờ vài giây');

    // Fetch user level via CombatResultsService helper (it has users repo)
    // Reuse existing users repository from combatResultsService by asking it
    // to load the user; this is a small coupling but keeps code reuse.
    const user = await (
      this.combatResultsService as any
    ).usersRepository.findOne({ where: { id: userId }, relations: ['stats'] });
    if (!user) throw new Error('Người chơi không tồn tại');

    const level = Number(user.level) || 1;

    // Check stamina (5 cost)
    const staminaCost = 5;
    const stamina =
      await this.userStaminaService.getUserStaminaWithoutRegen(userId);
    if (stamina.currentStamina < staminaCost)
      throw new Error('Không đủ thể lực để đi săn');

    // Consume stamina
    await this.userStaminaService.consumeStamina(userId, staminaCost);

    // Set cooldown key (10s)
    await this.redis.set(key, '1', 'EX', 10);

    // Use WildAreaService to get monsters instead of all monsters
    const monsters = await this.wildAreaService.selectRandomMonsters(
      level,
      count,
    );

    if (!monsters || monsters.length === 0) {
      throw new Error('Không tìm thấy quái phù hợp trong khu dã ngoại');
    }

    // Build enemies payload for the worker
    const enemyPayload = monsters.map((monster) => ({
      monsterId: Number(monster.id),
      count: 1,
    }));

    // Enqueue combat job and wait for its completion with timeout (10s)
    const job = await combatQueue.add('startCombat', {
      userIds: [userId],
      enemies: enemyPayload,
      source: 'wildarea',
    });

    // Wait for completion (job.waitUntilFinished requires a QueueEvents connection inside worker),
    // fallback: poll for result via Redis pubsub channel 'combat:result' as worker publishes there.
    // We'll implement a simple promise that listens to Redis channel for matching result

    return await new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        // if not finished within 10s, return jobId so client can poll
        resolve({ jobId: job.id });
      }, 10000);

      const sub = new Redis(REDIS_CONN);
      sub.subscribe('combat:result', (err) => {
        if (err) {
          clearTimeout(timeout);
          sub.disconnect();
          reject(err);
        }
      });

      sub.on('message', (_ch, message) => {
        try {
          const parsed = JSON.parse(message);
          // match the job by jobId which worker publishes
          if (parsed?.jobId && parsed.jobId === job.id) {
            clearTimeout(timeout);
            sub.disconnect();
            resolve({ combatResult: parsed.result });
          }
        } catch (err) {
          // ignore parse errors
        }
      });
    });
  }
}
