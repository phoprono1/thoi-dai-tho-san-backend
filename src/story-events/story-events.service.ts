import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { StoryEvent } from './story-event.entity';
import { StoryEventUserContrib } from './story-event-user-contrib.entity';
import { StoryEventGlobal } from './story-event-global.entity';
import { StoryEventCombatTracking } from './story-event-combat-tracking.entity';
import { UserItem } from '../user-items/user-item.entity';

export type RewardSpec =
  | {
      mode: 'pool';
      goldPool?: number;
      itemPools?: { itemId: number; qty: number }[];
    }
  | {
      mode: 'perPoint';
      goldPerPoint?: number;
      itemsPerPoint?: { itemId: number; qtyPerPoint: number }[];
    };

type QuerySumRow = { s: string | number | null };
export type ContribRow = {
  userId: number;
  totalScore: number;
  itemsContributed?: number;
  enemyKills?: number;
  dungeonClears?: number;
  username?: string;
};

type MergedRewardSpec = {
  mode?: 'pool' | 'perPoint';
  goldPool?: number;
  goldPerPoint?: number;
  itemPools?: { itemId: number; qty: number }[];
  itemsPerPoint?: { itemId: number; qtyPerPoint?: number; qty?: number }[];
  minGold?: number;
  minItem?: number;
};

@Injectable()
export class StoryEventsService {
  private readonly logger = new Logger(StoryEventsService.name);
  constructor(
    @InjectRepository(StoryEvent)
    private readonly storyEventRepo: Repository<StoryEvent>,
    @InjectRepository(StoryEventUserContrib)
    private readonly userContribRepo: Repository<StoryEventUserContrib>,
    @InjectRepository(StoryEventGlobal)
    private readonly globalRepo: Repository<StoryEventGlobal>,
    @InjectRepository(StoryEventCombatTracking)
    private readonly trackingRepo: Repository<StoryEventCombatTracking>,
    private readonly dataSource: DataSource,
  ) {}

  private async typedQuery<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const raw: unknown = await this.dataSource.manager.query(sql, params || []);
    if (!Array.isArray(raw)) return [];
    return raw as T[];
  }

  async createEvent(data: Partial<StoryEvent>) {
    // normalize incoming date strings if present
    if (data?.eventStart && typeof data.eventStart === 'string') {
      data.eventStart = new Date(data.eventStart);
    }
    if (data?.eventEnd && typeof data.eventEnd === 'string') {
      data.eventEnd = new Date(data.eventEnd);
    }

    const e = this.storyEventRepo.create(data);
    const saved = await this.storyEventRepo.save(e);
    // create global progress row if enabled
    if (saved && saved.globalEnabled) {
      try {
        await this.globalRepo.save({ storyEventId: saved.id });
      } catch {
        // best-effort: ignore duplicate/global save failures
      }
    }
    // If eventStart was not provided, default it to createdAt so contributions
    // are only counted from creation time.
    if (!saved.eventStart) {
      try {
        saved.eventStart = saved.createdAt;
        await this.storyEventRepo.update(saved.id, {
          eventStart: saved.createdAt,
        });
      } catch {
        // ignore update failure
      }
    }

    return saved;
  }

  async updateEvent(id: number, data: Partial<StoryEvent>) {
    // normalize date strings
    if (data?.eventStart && typeof data.eventStart === 'string') {
      data.eventStart = new Date(data.eventStart);
    }
    if (data?.eventEnd && typeof data.eventEnd === 'string') {
      data.eventEnd = new Date(data.eventEnd);
    }

    await this.storyEventRepo.update(id, data);
    return this.getEvent(id);
  }

  async deleteEvent(id: number) {
    // soft-delete: mark inactive
    await this.storyEventRepo.update(id, { isActive: false });
    return { success: true };
  }

  async getEvent(id: number) {
    return this.storyEventRepo.findOne({ where: { id } });
  }

  async listActive() {
    return this.storyEventRepo.find({ where: { isActive: true } });
  }

  // Minimal contrib handler example: increment dungeon clears for a user
  async incrementDungeonClear(eventId: number, userId: number, count = 1) {
    // ensure user contrib row exists
    let uc = await this.userContribRepo.findOne({
      where: { storyEventId: eventId, userId },
    });
    if (!uc) {
      uc = this.userContribRepo.create({
        storyEventId: eventId,
        userId,
      } as Partial<StoryEventUserContrib>);
      uc = await this.userContribRepo.save(uc);
    }

    uc.dungeonClears = (uc.dungeonClears || 0) + count;
    uc.totalScore = (uc.totalScore || 0) + count; // simplistic scoring
    uc.lastContributionAt = new Date();
    await this.userContribRepo.save(uc);

    // update global (best-effort)
    try {
      await this.globalRepo.query(
        `UPDATE story_event_global SET "totalDungeonClears" = "totalDungeonClears" + $1 WHERE "storyEventId" = $2`,
        [count, eventId],
      );
    } catch (e) {
      this.logger.warn('Failed to update global progress: ' + String(e));
    }
  }

  // Process a combat result for a single user and update any active story events.
  // Ensures idempotency using story_event_combat_tracking unique index.
  async processCombatForUser(
    userId: number,
    combatResultId: number,
    payload: {
      dungeonId?: number | null;
      enemyKills?: { enemyType: string; count: number }[];
      collectedItems?: { itemId: number; quantity: number }[];
      bossDefeated?: boolean;
    },
  ) {
    // Find active events that are currently running
    const now = new Date();
    const events = await this.storyEventRepo.find({
      where: { isActive: true },
    });

    for (const ev of events) {
      try {
        // Skip events that have a time window and are not active now
        if (ev.eventStart && ev.eventStart > now) continue;
        if (ev.eventEnd && ev.eventEnd < now) continue;

        // Check if this combatResult was already processed for this event+user
        const existing = await this.trackingRepo.findOne({
          where: { storyEventId: ev.id, userId, combatResultId },
        });
        if (existing) continue; // already processed

        // Ensure a user contrib row exists
        let uc = await this.userContribRepo.findOne({
          where: { storyEventId: ev.id, userId },
        });
        if (!uc) {
          uc = this.userContribRepo.create({
            storyEventId: ev.id,
            userId,
          } as Partial<StoryEventUserContrib>);
          uc = await this.userContribRepo.save(uc);
        }

        let contributed = false;

        // Dungeon clear
        if (payload.dungeonId) {
          uc.dungeonClears = (uc.dungeonClears || 0) + 1;
          contributed = true;
          // update global
          await this.globalRepo.query(
            `UPDATE story_event_global SET "totalDungeonClears" = "totalDungeonClears" + 1 WHERE "storyEventId" = $1`,
            [ev.id],
          );
        }

        // Enemy kills
        if (
          Array.isArray(payload.enemyKills) &&
          payload.enemyKills.length > 0
        ) {
          for (const k of payload.enemyKills) {
            const delta = Number(k.count || 0) || 0;
            if (delta <= 0) continue;
            uc.enemyKills = (uc.enemyKills || 0) + delta;
            contributed = true;
            await this.globalRepo.query(
              `UPDATE story_event_global SET "totalEnemyKills" = "totalEnemyKills" + $1 WHERE "storyEventId" = $2`,
              [delta, ev.id],
            );
          }
        }

        // Collected items
        if (
          Array.isArray(payload.collectedItems) &&
          payload.collectedItems.length > 0
        ) {
          let totalItems = 0;
          for (const it of payload.collectedItems) {
            totalItems += Number(it.quantity || 0) || 0;
          }
          if (totalItems > 0) {
            uc.itemsContributed = (uc.itemsContributed || 0) + totalItems;
            contributed = true;
            await this.globalRepo.query(
              `UPDATE story_event_global SET "totalItemsContributed" = "totalItemsContributed" + $1 WHERE "storyEventId" = $2`,
              [totalItems, ev.id],
            );
          }
        }

        if (contributed) {
          // Recompute simplistic totalScore (weights can be customized in rewardConfig)
          const score =
            (uc.dungeonClears || 0) * 10 +
            (uc.enemyKills || 0) * 1 +
            (uc.itemsContributed || 0) * 5;
          uc.totalScore = score;
          uc.lastContributionAt = new Date();
          await this.userContribRepo.save(uc);
        }

        // Insert tracking row to avoid reprocessing this combatResult for this event+user
        await this.trackingRepo.save({
          storyEventId: ev.id,
          userId,
          combatResultId,
        } as Partial<StoryEventCombatTracking>);
      } catch (err) {
        this.logger.warn(
          `Failed to process combat for event ${ev.id} user ${userId}: ${String(err)}`,
        );
      }
    }
  }

  // Transactional item contribution: deducts user item and records contribution for event
  async contributeItem(
    eventId: number,
    userId: number,
    itemId: number,
    quantity = 1,
  ) {
    if (!eventId || !userId || !itemId) {
      throw new BadRequestException('Missing parameters');
    }
    if (quantity <= 0) throw new BadRequestException('Quantity must be >= 1');

    // Ensure event exists and is active/time-valid
    const ev = await this.storyEventRepo.findOne({ where: { id: eventId } });
    if (!ev) throw new BadRequestException('Event not found');
    const now = new Date();
    if (!ev.isActive) throw new BadRequestException('Event is not active');
    if (ev.eventStart && ev.eventStart > now)
      throw new BadRequestException('Event has not started');
    if (ev.eventEnd && ev.eventEnd < now)
      throw new BadRequestException('Event has ended');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Lock user's item row
      const userItem = await queryRunner.manager
        .createQueryBuilder(UserItem, 'ui')
        .setLock('pessimistic_write')
        .where('ui.userId = :userId AND ui.itemId = :itemId', {
          userId,
          itemId,
        })
        .getOne();

      if (!userItem)
        throw new BadRequestException('User does not own the item');
      if ((userItem.quantity || 0) < quantity)
        throw new BadRequestException('Not enough item quantity');

      // Deduct or delete
      if (userItem.quantity === quantity) {
        await queryRunner.manager.delete(UserItem, { id: userItem.id });
      } else {
        await queryRunner.manager.update(
          UserItem,
          { id: userItem.id },
          { quantity: userItem.quantity - quantity },
        );
      }

      // Ensure a user contrib row exists (lock if present)
      let uc = await queryRunner.manager.findOne(StoryEventUserContrib, {
        where: { storyEventId: eventId, userId },
      });
      if (!uc) {
        uc = queryRunner.manager.create(StoryEventUserContrib, {
          storyEventId: eventId,
          userId,
          itemsContributed: 0,
          totalScore: 0,
        } as Partial<StoryEventUserContrib>);
        uc = await queryRunner.manager.save(uc);
      }

      // Update user contrib counters
      uc.itemsContributed = (Number(uc.itemsContributed) || 0) + quantity;
      // Recompute simplistic score (weights: dungeon 10, enemy 1, item 5)
      const score =
        (Number(uc.dungeonClears) || 0) * 10 +
        (Number(uc.enemyKills) || 0) * 1 +
        (Number(uc.itemsContributed) || 0) * 5;
      uc.totalScore = score;
      uc.lastContributionAt = new Date();
      await queryRunner.manager.save(uc);

      // Update global counters if exists
      try {
        await queryRunner.manager.query(
          `UPDATE story_event_global SET "totalItemsContributed" = COALESCE("totalItemsContributed",0) + $1 WHERE "storyEventId" = $2`,
          [quantity, eventId],
        );
      } catch (e) {
        // best-effort; continue
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        contributed: quantity,
        newItemsContributed: uc.itemsContributed,
        totalScore: uc.totalScore,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Backfill runner: iterate all users in batches and compute contributions from historical combat_result and donations
  async runBackfillForEvent(
    eventId: number,
    opts: { batchSize?: number } = {},
  ) {
    const batchSize = opts.batchSize || 200;
    // Strategy: iterate through all users (from user table) in batches and ensure a user contrib row exists.
    // For simplicity / safety we will only create rows and not recompute historical scores here.
    // A more advanced implementation would aggregate historical combat_result rows.
    const totalUsers = await this.typedQuery<{ c: string | number }>(
      'SELECT COUNT(1) as c FROM "user"',
    );
    const count = Number(totalUsers?.[0]?.c || 0);

    let processed = 0;
    for (let offset = 0; offset < count; offset += batchSize) {
      const rows = await this.typedQuery<{ id: number }>(
        'SELECT id FROM "user" ORDER BY id LIMIT $1 OFFSET $2',
        [batchSize, offset],
      );
      const ids = rows.map((r) => r.id).filter(Boolean);
      if (ids.length === 0) break;

      // Bulk upsert create user contrib rows if not exists
      const values = ids.map((id) => `(${eventId}, ${id})`).join(',');
      const sql = `INSERT INTO story_event_user_contrib("storyEventId","userId") VALUES ${values} ON CONFLICT ("storyEventId","userId") DO NOTHING`;
      try {
        await this.dataSource.manager.query(sql);
      } catch (err) {
        this.logger.warn('Backfill batch insert failed: ' + String(err));
      }

      processed += ids.length;
    }

    return { processed };
  }

  // Leaderboard: top N contributors by totalScore
  async getTopContributors(eventId: number, limit = 50, offset = 0) {
    const rows = await this.typedQuery<ContribRow>(
      `SELECT u."userId", u."totalScore", u."itemsContributed", u."enemyKills", u."dungeonClears", usr.username FROM story_event_user_contrib u LEFT JOIN "user" usr ON usr.id = u."userId" WHERE u."storyEventId" = $1 ORDER BY u."totalScore" DESC NULLS LAST LIMIT $2 OFFSET $3`,
      [eventId, limit, offset],
    );
    return rows;
  }

  // Reward distribution: compute proportional rewards and credit users (transactional)
  async distributeRewards(
    eventId: number,
    rewardSpec: RewardSpec = { mode: 'pool' },
  ) {
    // Load event and merge per-event rewardConfig with provided rewardSpec (spec overrides event defaults)
    const ev = await this.storyEventRepo.findOne({ where: { id: eventId } });
    const eventCfg = (ev && (ev.rewardConfig as MergedRewardSpec)) || {};
    // Merged spec: start from eventCfg then overlay rewardSpec
    const mergedSpec: MergedRewardSpec = Object.assign(
      {},
      eventCfg,
      rewardSpec || {},
    );

    // Fetch total score
    const global = await this.typedQuery<{ s: string | number }>(
      'SELECT SUM("totalScore") as s FROM story_event_user_contrib WHERE "storyEventId" = $1',
      [eventId],
    );
    const totalScore = Number(global?.[0]?.s || 0);
    if (!totalScore || totalScore <= 0)
      return { distributed: 0, reason: 'no_score' };

    const rows = await this.typedQuery<{ userId: number; totalScore: number }>(
      'SELECT "userId", "totalScore" FROM story_event_user_contrib WHERE "storyEventId" = $1 AND "totalScore" > 0',
      [eventId],
    );

    // Prepare distribution plan
    const plan: Record<
      number,
      { gold: number; items: { itemId: number; qty: number }[] }
    > = {};
    rows.forEach((r) => {
      plan[r.userId] = { gold: 0, items: [] };
    });

    if (mergedSpec.mode === 'perPoint') {
      // Per-point simple allocation
      const gp = Number(mergedSpec.goldPerPoint || 0);
      const itemsPer = (mergedSpec.itemsPerPoint || []) as Array<{
        itemId: number;
        qtyPerPoint?: number;
        qty?: number;
      }>;
      for (const r of rows) {
        const uid = r.userId;
        const score = Number(r.totalScore || 0);
        const gold = Math.floor(score * gp);
        plan[uid].gold = Math.max(0, gold);
        for (const it of itemsPer) {
          const qty = Math.max(
            0,
            Math.floor(score * (it.qtyPerPoint || it.qty || 0)),
          );
          if (qty > 0) plan[uid].items.push({ itemId: it.itemId, qty });
        }
      }
    } else {
      // Pool mode with Largest Remainder (Hamilton) rounding
      const gp = Number(mergedSpec.goldPool || 0);
      const itemPools: { itemId: number; qty: number }[] =
        mergedSpec.itemPools ?? [];

      // Gold allocation using Largest Remainder
      if (gp && gp > 0) {
        const rawShares = rows.map((r) => ({
          userId: r.userId,
          raw: (Number(r.totalScore) || 0) * (gp / totalScore),
        }));
        const baseShares = new Map<number, number>();
        for (const s of rawShares) baseShares.set(s.userId, Math.floor(s.raw));
        const allocated = Array.from(baseShares.values()).reduce(
          (a, b) => a + b,
          0,
        );
        let remaining = Math.max(0, Math.floor(gp) - allocated);
        const remainders = rawShares.map((s) => ({
          userId: s.userId,
          frac: s.raw - Math.floor(s.raw),
        }));
        remainders.sort((a, b) => b.frac - a.frac);
        let idx = 0;
        while (remaining > 0 && idx < remainders.length) {
          const uid = remainders[idx].userId;
          baseShares.set(uid, (baseShares.get(uid) || 0) + 1);
          remaining--;
          idx++;
        }
        // assign baseShares into plan
        for (const [uid, val] of baseShares.entries()) {
          plan[uid].gold = (plan[uid].gold || 0) + val;
        }
      }

      // Items allocation via Largest Remainder per pool
      for (const pool of itemPools) {
        const poolQty = pool.qty || 0;
        if (!poolQty || poolQty <= 0) continue;
        const rawShares = rows.map((r) => ({
          userId: r.userId,
          raw: (Number(r.totalScore) || 0) * (poolQty / totalScore),
        }));
        const baseShares = new Map<number, number>();
        for (const s of rawShares) baseShares.set(s.userId, Math.floor(s.raw));
        const allocated = Array.from(baseShares.values()).reduce(
          (a, b) => a + b,
          0,
        );
        let remaining = Math.max(0, Math.floor(poolQty) - allocated);
        const remainders = rawShares.map((s) => ({
          userId: s.userId,
          frac: s.raw - Math.floor(s.raw),
        }));
        remainders.sort((a, b) => b.frac - a.frac);
        let idx2 = 0;
        while (remaining > 0 && idx2 < remainders.length) {
          const uid = remainders[idx2].userId;
          baseShares.set(uid, (baseShares.get(uid) || 0) + 1);
          remaining--;
          idx2++;
        }

        // assign item quantities into plan
        for (const [uid, val] of baseShares.entries()) {
          if (val <= 0) continue;
          if (!plan[uid].items) plan[uid].items = [];
          const found = plan[uid].items.find((x) => x.itemId === pool.itemId);
          if (found) found.qty = (found.qty || 0) + val;
          else plan[uid].items.push({ itemId: pool.itemId, qty: val });
        }
      }
    }

    // Enforce min thresholds: can be configured per-event via rewardConfig
    const minGold =
      typeof mergedSpec.minGold === 'number' ? Number(mergedSpec.minGold) : 1;
    const minItem =
      typeof mergedSpec.minItem === 'number' ? Number(mergedSpec.minItem) : 1;

    // Commit distribution transactionally
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      let distributedCount = 0;
      const perUserSummary: any[] = [];

      for (const r of rows) {
        const uid = r.userId;
        const entry = plan[uid] || { gold: 0, items: [] };
        const toGold = Math.max(0, Math.floor(entry.gold || 0));
        if (toGold >= minGold) {
          await queryRunner.manager.query(
            'UPDATE "user" SET gold = COALESCE(gold,0) + $1 WHERE id = $2',
            [toGold, uid],
          );
        }

        // items
        for (const it of entry.items || []) {
          if ((it.qty || 0) < minItem) continue;
          await queryRunner.manager.query(
            'INSERT INTO user_item("userId","itemId","quantity") VALUES ($1,$2,$3) ON CONFLICT ("userId","itemId") DO UPDATE SET quantity = user_item.quantity + EXCLUDED.quantity',
            [uid, it.itemId, it.qty],
          );
        }

        perUserSummary.push({
          userId: uid,
          gold: toGold,
          items: entry.items || [],
        });
        distributedCount++;
      }

      // Mark event distributed
      await queryRunner.manager.query(
        'UPDATE story_events SET "rewardDistributedAt" = now(), "isActive" = false WHERE id = $1',
        [eventId],
      );

      // Insert audit record
      await queryRunner.manager.query(
        'INSERT INTO story_event_reward_distribution("storyEventId","executedBy","config","summary") VALUES ($1,$2,$3,$4)',
        [
          eventId,
          null,
          JSON.stringify(rewardSpec),
          JSON.stringify({ perUserSummary }),
        ],
      );

      await queryRunner.commitTransaction();
      return { distributed: distributedCount, summary: perUserSummary };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
