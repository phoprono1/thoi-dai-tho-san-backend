import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { combatQueue } from '../queues/combat.queue';
import { MonsterService } from '../monsters/monster.service';
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
    private readonly monsterService: MonsterService,
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

    const level = user.level || 1;

    // Level range: [level-3 .. level+1]
    const minLevel = Math.max(1, level - 3);
    const maxLevel = Math.max(minLevel, level + 1);

    const candidates = await this.monsterService.getMonstersByLevelRange(
      minLevel,
      maxLevel,
    );
    if (!candidates || candidates.length === 0)
      throw new Error('Không tìm thấy quái phù hợp');

    // Randomly select `count` monsters with replacement allowed
    const selected: any[] = [];
    for (let i = 0; i < count; i++) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      selected.push({ monsterId: pick.id });
    }

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

    // Build enemies payload for the worker: similar shape to dungeon.monsterCounts
    const enemyPayload = selected.map((s, idx) => ({
      monsterId: Number(s.monsterId),
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
