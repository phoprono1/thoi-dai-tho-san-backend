import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { StoryEvent } from './story-event.entity';
import { CombatResult } from '../combat-results/combat-result.entity';
import { StoryEventUserContrib } from './story-event-user-contrib.entity';
import { StoryEventGlobal } from './story-event-global.entity';
import { StoryEventCombatTracking } from './story-event-combat-tracking.entity';
import { MailboxService, SendMailDto } from '../mailbox/mailbox.service';
import { MailType } from '../mailbox/mailbox.entity';
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

// QuerySumRow removed (unused)
export type ContribRow = {
  userId: number;
  totalScore: number;
  score?: number;
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

type Requirements = {
  completeDungeons?: Array<{ dungeonId: number; count?: number }>;
  killEnemies?: Array<{ enemyType: string; count?: number }>;
  collectItems?: Array<{ itemId: number; quantity?: number }>;
  defeatBoss?: boolean;
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
    @InjectRepository(CombatResult)
    private readonly combatResultRepo: Repository<CombatResult>,
    private readonly dataSource: DataSource,
    private readonly mailboxService: MailboxService,
  ) {}

  // Return scoring weights with sensible defaults when event.scoringWeights is null
  private getScoringWeights(ev?: StoryEvent) {
    const w = (ev && (ev.scoringWeights as Record<string, number>)) || {};
    const dungeonW = Number(w.dungeonClear ?? 10) || 10;
    const enemyW = Number(w.enemyKill ?? 1) || 1;
    const itemW = Number(w.itemDonate ?? 5) || 5;
    return { dungeonW, enemyW, itemW };
  }

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

  async hardDeleteEvent(id: number) {
    // hard delete: remove from database completely
    // First delete related records
    await this.trackingRepo.delete({ storyEventId: id });
    await this.userContribRepo.delete({ storyEventId: id });
    await this.globalRepo.delete({ storyEventId: id });
    // Then delete the event itself
    await this.storyEventRepo.delete(id);
    return { success: true };
  }

  async getEvent(id: number) {
    return this.storyEventRepo.findOne({ where: { id } });
  }

  async listActive() {
    try {
      return await this.storyEventRepo.find({ where: { isActive: true } });
    } catch (err) {
      // Log full error and stack so we can diagnose 500s from the admin UI
      this.logger.error('Failed to list active story events: ' + String(err));
      const getStack = (e: unknown): string | undefined => {
        if (!e) return undefined;
        if (e instanceof Error) return e.stack;
        try {
          const maybe = e as Record<string, unknown>;
          if (maybe && typeof maybe['stack'] === 'string')
            return String(maybe['stack']);
        } catch {
          // ignore
        }
        return undefined;
      };
      const stack = getStack(err);
      if (stack) this.logger.error(stack);
      throw err;
    }
  }

  async listAll() {
    try {
      return await this.storyEventRepo.find({
        order: { createdAt: 'DESC' },
      });
    } catch (err) {
      this.logger.error('Failed to list all story events: ' + String(err));
      throw err;
    }
  }

  async listHistory() {
    try {
      return await this.storyEventRepo.find({
        where: { isActive: false },
        order: { createdAt: 'DESC' },
      });
    } catch (err) {
      this.logger.error('Failed to list story event history: ' + String(err));
      throw err;
    }
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
    // Recompute totalScore using event scoringWeights if available
    const ev = await this.storyEventRepo.findOne({ where: { id: eventId } });
    const w: Record<string, number> =
      (ev && (ev.scoringWeights as Record<string, number>)) || {};
    const dungeonW = Number(w.dungeonClear ?? 10) || 10;
    const enemyW = Number(w.enemyKill ?? 1) || 1;
    const itemW = Number(w.itemDonate ?? 5) || 5;
    uc.totalScore =
      (uc.dungeonClears || 0) * dungeonW +
      (uc.enemyKills || 0) * enemyW +
      (uc.itemsContributed || 0) * itemW;
    uc.lastContributionAt = new Date();
    await this.userContribRepo.save(uc);

    // update global (best-effort)
    try {
      await this.globalRepo.query(
        `UPDATE story_event_global SET "totalDungeonClears" = "totalDungeonClears" + $1 WHERE "storyEventId" = $2`,
        [count, eventId],
      );
      // after updating global totals, check if we reached a target and auto-distribute
      try {
        await this.checkAndMaybeDistribute(eventId);
      } catch (e) {
        // non-fatal: log and continue
        this.logger.warn('Auto-distribute check failed: ' + String(e));
      }
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

        // Load combatResult to check timestamp and attribution
        const combatResult = await this.combatResultRepo.findOne({
          where: { id: combatResultId },
        });
        if (!combatResult) continue;

        // If combat predates event start, skip (we count only contributions after event start)
        if (
          ev.eventStart &&
          combatResult.createdAt &&
          combatResult.createdAt < ev.eventStart
        ) {
          continue;
        }
        if (
          ev.eventEnd &&
          combatResult.createdAt &&
          combatResult.createdAt > ev.eventEnd
        ) {
          continue;
        }

        // Typed requirements helper
        const req = (ev.requirements as Requirements) || undefined;

        // Helper to normalize strings (lowercase + strip diacritics) for robust matching
        const normalize = (s: string | undefined | null) => {
          if (!s) return '';
          try {
            return String(s)
              .normalize('NFD')
              .replace(/\p{Diacritic}/gu, '')
              .toLowerCase()
              .trim();
          } catch {
            // Fallback for environments where Unicode property escapes are unavailable
            return String(s)
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .trim();
          }
        };

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

        // Dungeon clear: apply only if event has no requirement or the dungeon is listed
        if (payload.dungeonId) {
          const shouldCountDungeon =
            !req ||
            !req.completeDungeons ||
            req.completeDungeons.some(
              (d) => Number(d.dungeonId) === Number(payload.dungeonId),
            );
          if (shouldCountDungeon) {
            console.log('Before dungeon clear:', {
              userId,
              dungeonClears: uc.dungeonClears,
              type: typeof uc.dungeonClears,
            });
            uc.dungeonClears = (Number(uc.dungeonClears) || 0) + 1;
            console.log('After dungeon clear:', {
              userId,
              dungeonClears: uc.dungeonClears,
            });
            contributed = true;
            // update global
            try {
              await this.globalRepo.query(
                `UPDATE story_event_global SET "totalDungeonClears" = "totalDungeonClears" + 1 WHERE "storyEventId" = $1`,
                [ev.id],
              );
              await this.checkAndMaybeDistribute(ev.id);
            } catch (e) {
              this.logger.warn(
                'Failed to update global dungeon clears: ' + String(e),
              );
            }
          }
        }

        // Enemy kills
        if (
          Array.isArray(payload.enemyKills) &&
          payload.enemyKills.length > 0
        ) {
          for (const k of payload.enemyKills) {
            const delta = Number(k.count || 0) || 0;
            if (delta <= 0) continue;
            // check event requirements: either no killEnemies requirement or matches one (supports 'any')
            const shouldCountKill =
              !req ||
              !req.killEnemies ||
              req.killEnemies.some((r) => {
                const reqType = normalize(String(r.enemyType || ''));
                const killType = normalize(String(k.enemyType || ''));
                return reqType === 'any' || reqType === killType;
              });
            if (!shouldCountKill) continue;
            console.log('Before enemy kill:', {
              userId,
              enemyKills: uc.enemyKills,
              delta,
              type: typeof uc.enemyKills,
            });
            uc.enemyKills = (Number(uc.enemyKills) || 0) + delta;
            console.log('After enemy kill:', {
              userId,
              enemyKills: uc.enemyKills,
            });
            contributed = true;
            try {
              await this.globalRepo.query(
                `UPDATE story_event_global SET "totalEnemyKills" = "totalEnemyKills" + $1 WHERE "storyEventId" = $2`,
                [delta, ev.id],
              );
              await this.checkAndMaybeDistribute(ev.id);
            } catch (e) {
              this.logger.warn(
                'Failed to update global enemy kills: ' + String(e),
              );
            }
          }
        }

        // Collected items
        if (
          Array.isArray(payload.collectedItems) &&
          payload.collectedItems.length > 0
        ) {
          let totalItems = 0;
          for (const it of payload.collectedItems) {
            // Check if event requires specific item and only count matching ones
            const shouldCountItem =
              !req ||
              !req.collectItems ||
              req.collectItems.some(
                (ri) => Number(ri.itemId) === Number(it.itemId),
              );
            if (!shouldCountItem) continue;
            totalItems += Number(it.quantity || 0) || 0;
          }
          if (totalItems > 0) {
            uc.itemsContributed = (uc.itemsContributed || 0) + totalItems;
            contributed = true;
            try {
              await this.globalRepo.query(
                `UPDATE story_event_global SET "totalItemsContributed" = "totalItemsContributed" + $1 WHERE "storyEventId" = $2`,
                [totalItems, ev.id],
              );
              await this.checkAndMaybeDistribute(ev.id);
            } catch (e) {
              this.logger.warn(
                'Failed to update global items contributed: ' + String(e),
              );
            }
          }
        }

        if (contributed) {
          // Recompute totalScore using event scoringWeights if present
          const { dungeonW, enemyW, itemW } = this.getScoringWeights(ev);
          console.log('Recalculating score:', {
            userId,
            dungeonClears: uc.dungeonClears,
            enemyKills: uc.enemyKills,
            itemsContributed: uc.itemsContributed,
            weights: { dungeonW, enemyW, itemW },
          });
          const score =
            (Number(uc.dungeonClears) || 0) * dungeonW +
            (Number(uc.enemyKills) || 0) * enemyW +
            (Number(uc.itemsContributed) || 0) * itemW;
          uc.totalScore = score;
          console.log('New score:', { userId, totalScore: uc.totalScore });
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

    // If event has specific collectItems requirement, ensure donated item is allowed
    try {
      const req = (ev.requirements as Requirements) || undefined;
      if (
        req &&
        Array.isArray(req.collectItems) &&
        req.collectItems.length > 0
      ) {
        const allowed = req.collectItems.some(
          (ci) => Number(ci.itemId) === Number(itemId),
        );
        if (!allowed) {
          throw new BadRequestException(
            'This item is not accepted for this event',
          );
        }
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // if requirements parsing fails, be conservative and reject
      throw new BadRequestException('Invalid event requirements');
    }

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
      console.log('Before update:', {
        userId: uc.userId,
        dungeonClears: uc.dungeonClears,
        enemyKills: uc.enemyKills,
        itemsContributed: uc.itemsContributed,
        totalScore: uc.totalScore,
      });
      uc.itemsContributed = (Number(uc.itemsContributed) || 0) + quantity;
      // Recompute totalScore using event scoringWeights if present
      const {
        dungeonW: dungeonW2,
        enemyW: enemyW2,
        itemW: itemW2,
      } = this.getScoringWeights(ev);
      const score2 =
        (Number(uc.dungeonClears) || 0) * dungeonW2 +
        (Number(uc.enemyKills) || 0) * enemyW2 +
        (Number(uc.itemsContributed) || 0) * itemW2;
      uc.totalScore = score2;
      console.log('After update:', {
        userId: uc.userId,
        dungeonClears: uc.dungeonClears,
        enemyKills: uc.enemyKills,
        itemsContributed: uc.itemsContributed,
        totalScore: uc.totalScore,
        weights: { dungeonW2, enemyW2, itemW2 },
      });
      uc.lastContributionAt = new Date();
      await queryRunner.manager.save(uc);

      // Update global counters if exists
      try {
        await queryRunner.manager.query(
          `UPDATE story_event_global SET "totalItemsContributed" = COALESCE("totalItemsContributed",0) + $1 WHERE "storyEventId" = $2`,
          [quantity, eventId],
        );
        // after updating global totals, check auto-distribute
        try {
          // use repository outside transaction to avoid locking complexities; best-effort
          await this.checkAndMaybeDistribute(eventId);
        } catch (e) {
          this.logger.warn(
            'Auto-distribute check failed after donate: ' + String(e),
          );
        }
      } catch {
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

  // Check whether a globalTarget has been reached for the event and trigger
  // reward distribution if so. This is best-effort and non-blocking for
  // contribution flows.
  private async checkAndMaybeDistribute(eventId: number) {
    const ev = await this.storyEventRepo.findOne({ where: { id: eventId } });
    if (!ev) return false;
    if (!ev.globalEnabled) return false;
    if (!ev.globalTarget || Number(ev.globalTarget) <= 0) return false;

    // Compute total score across contributors as the canonical progress metric
    const total = await this.typedQuery<{ s: string | number }>(
      'SELECT SUM("totalScore") as s FROM story_event_user_contrib WHERE "storyEventId" = $1',
      [eventId],
    );
    const totalScore = Number(total?.[0]?.s || 0);
    if (totalScore >= Number(ev.globalTarget)) {
      // Trigger distribution using event's rewardConfig as the spec.
      try {
        const spec: RewardSpec = (ev.rewardConfig as RewardSpec) || {
          mode: 'pool',
        };
        // executedBy unknown for auto-distribute (system-triggered)
        await this.distributeRewards(eventId, spec, null);
        return true;
      } catch (e) {
        this.logger.warn(
          'Auto-distribute failed for event ' +
            String(eventId) +
            ': ' +
            String(e),
        );
        return false;
      }
    }

    return false;
  }

  // Leaderboard: top N contributors by totalScore
  async getTopContributors(eventId: number, limit = 50, offset = 0) {
    const rows = await this.typedQuery<ContribRow>(
      `SELECT u."userId", u."totalScore", u."totalScore" as "score", u."itemsContributed", u."enemyKills", u."dungeonClears", usr.username FROM story_event_user_contrib u LEFT JOIN "user" usr ON usr.id = u."userId" WHERE u."storyEventId" = $1 ORDER BY u."totalScore" DESC NULLS LAST LIMIT $2 OFFSET $3`,
      [eventId, limit, offset],
    );
    // Convert string fields to numbers
    return rows.map((row) => ({
      userId: Number(row.userId),
      totalScore: Number(row.totalScore || 0),
      score: Number(row.score || 0),
      itemsContributed: Number(row.itemsContributed || 0),
      enemyKills: Number(row.enemyKills || 0),
      dungeonClears: Number(row.dungeonClears || 0),
      username: row.username,
    }));
  }

  // Return global aggregated progress for an event (best-effort)
  async getGlobalProgress(eventId: number) {
    const rows = await this.typedQuery<{
      totalDungeonClears: number | null;
      totalEnemyKills: number | null;
      totalItemsContributed: number | null;
    }>(
      'SELECT "totalDungeonClears","totalEnemyKills","totalItemsContributed" FROM story_event_global WHERE "storyEventId" = $1',
      [eventId],
    );
    const r = rows?.[0] || {
      totalDungeonClears: 0,
      totalEnemyKills: 0,
      totalItemsContributed: 0,
    };
    return {
      totalDungeonClears: Number(r['totalDungeonClears'] || 0),
      totalEnemyKills: Number(r['totalEnemyKills'] || 0),
      totalItemsContributed: Number(r['totalItemsContributed'] || 0),
    };
  }

  // Reward distribution: compute proportional rewards and credit users (transactional)
  async distributeRewards(
    eventId: number,
    rewardSpec: RewardSpec = { mode: 'pool' },
    executedBy: number | null = null,
  ) {
    console.log(
      'DistributeRewards called for event',
      eventId,
      'spec',
      rewardSpec,
      'executedBy',
      executedBy,
    );
    this.logger.log(
      `DistributeRewards called for event ${eventId} by ${executedBy ?? 'system'} with spec: ${JSON.stringify(
        rewardSpec,
      )}`,
    );
    // Load event and merge per-event rewardConfig with provided rewardSpec (spec overrides event defaults)
    console.log('Loading event', eventId);
    const ev = await this.storyEventRepo.findOne({ where: { id: eventId } });
    console.log('Event loaded', ev);
    // Prevent double distribution
    if (!ev) throw new BadRequestException('Event not found');
    if (ev.rewardDistributedAt)
      return { distributed: 0, reason: 'already_distributed' };
    const eventCfg = (ev && (ev.rewardConfig as MergedRewardSpec)) || {};
    // Merged spec: start from eventCfg then overlay rewardSpec
    const mergedSpec: MergedRewardSpec = Object.assign(
      {},
      eventCfg,
      rewardSpec || {},
    );

    console.log('Fetching total score');
    // Fetch total score
    const global = await this.typedQuery<{ s: string | number }>(
      'SELECT SUM("totalScore") as s FROM story_event_user_contrib WHERE "storyEventId" = $1',
      [eventId],
    );
    const totalScore = Number(global?.[0]?.s || 0);
    console.log('Total score', totalScore);
    if (!totalScore || totalScore <= 0)
      return { distributed: 0, reason: 'no_score' };

    console.log('Fetching contributors');
    const rows = await this.typedQuery<{ userId: number; totalScore: number }>(
      'SELECT "userId", "totalScore" FROM story_event_user_contrib WHERE "storyEventId" = $1 AND "totalScore" > 0',
      [eventId],
    );
    console.log('Contributors', rows.length);

    // Prepare distribution plan
    const plan: Record<
      number,
      { gold: number; items: { itemId: number; qty: number }[] }
    > = {};
    rows.forEach((r) => {
      plan[r.userId] = { gold: 0, items: [] };
    });

    console.log('Computing plan');
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

      // Items allocation per pool with optional guaranteed minimum (minItem)
      for (const pool of itemPools) {
        const poolQty = pool.qty || 0;
        if (!poolQty || poolQty <= 0) continue;

        const participants = rows.length;
        const guaranteed = Math.max(0, Math.floor(mergedSpec.minItem || 1));

        // If pool has enough items to guarantee `guaranteed` per participant,
        // reserve those first and distribute the remainder proportionally.
        if (guaranteed > 0 && poolQty >= participants * guaranteed) {
          const remainingAfterGuarantee = poolQty - participants * guaranteed;

          // assign guaranteed to everyone
          for (const r of rows) {
            const uid = r.userId;
            if (!plan[uid].items) plan[uid].items = [];
            const found = plan[uid].items.find((x) => x.itemId === pool.itemId);
            if (found) found.qty = (found.qty || 0) + guaranteed;
            else plan[uid].items.push({ itemId: pool.itemId, qty: guaranteed });
          }

          // distribute remainingAfterGuarantee by Largest Remainder
          if (remainingAfterGuarantee > 0) {
            const rawShares = rows.map((r) => ({
              userId: r.userId,
              raw:
                (Number(r.totalScore) || 0) *
                (remainingAfterGuarantee / totalScore),
            }));
            const baseShares = new Map<number, number>();
            for (const s of rawShares)
              baseShares.set(s.userId, Math.floor(s.raw));
            const allocated = Array.from(baseShares.values()).reduce(
              (a, b) => a + b,
              0,
            );
            let remaining = Math.max(
              0,
              Math.floor(remainingAfterGuarantee) - allocated,
            );
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

            for (const [uid, val] of baseShares.entries()) {
              if (val <= 0) continue;
              if (!plan[uid].items) plan[uid].items = [];
              const found = plan[uid].items.find(
                (x) => x.itemId === pool.itemId,
              );
              if (found) found.qty = (found.qty || 0) + val;
              else plan[uid].items.push({ itemId: pool.itemId, qty: val });
            }
          }
        } else {
          // Not enough items to guarantee a minimum for everyone: distribute poolQty proportionally
          const rawShares = rows.map((r) => ({
            userId: r.userId,
            raw: (Number(r.totalScore) || 0) * (poolQty / totalScore),
          }));
          const baseShares = new Map<number, number>();
          for (const s of rawShares)
            baseShares.set(s.userId, Math.floor(s.raw));
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

          for (const [uid, val] of baseShares.entries()) {
            if (val <= 0) continue;
            if (!plan[uid].items) plan[uid].items = [];
            const found = plan[uid].items.find((x) => x.itemId === pool.itemId);
            if (found) found.qty = (found.qty || 0) + val;
            else plan[uid].items.push({ itemId: pool.itemId, qty: val });
          }
        }
      }
    }

    console.log('Plan computed', plan);

    // Enforce min thresholds: can be configured per-event via rewardConfig
    const minGold =
      typeof mergedSpec.minGold === 'number' ? Number(mergedSpec.minGold) : 1;
    const minItem =
      typeof mergedSpec.minItem === 'number' ? Number(mergedSpec.minItem) : 1;

    console.log('Starting transaction');
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
        const toGold = Math.floor(entry.gold || 0);
        const toItems = (entry.items || []).filter(
          (it) => (it.qty || 0) >= minItem,
        );

        // Send reward mail instead of direct crediting
        if (toGold >= minGold || toItems.length > 0) {
          try {
            const mailDto: SendMailDto = {
              userId: uid,
              title: `Story Event Reward`,
              content: `Congratulations! You've received rewards for participating in the story event.`,
              type: MailType.REWARD,
              rewards: {
                gold: toGold >= minGold ? toGold : undefined,
                items:
                  toItems.length > 0
                    ? toItems.map((it) => ({
                        itemId: it.itemId,
                        quantity: it.qty,
                      }))
                    : undefined,
              },
            };
            await this.mailboxService.sendMail(mailDto);
            console.log(
              'Sent reward mail to user',
              uid,
              'gold',
              toGold,
              'items',
              toItems,
            );
          } catch (e) {
            console.log('Failed to send reward mail to user', uid, 'error', e);
            this.logger.warn(
              `Failed to send reward mail to user ${uid}: ${String(e)}`,
            );
            // continue with other users
          }
        }

        perUserSummary.push({
          userId: uid,
          gold: toGold,
          items: entry.items || [],
        });
        distributedCount++;
      }

      console.log('Marking event distributed');
      // Mark event distributed
      await queryRunner.manager.query(
        'UPDATE story_events SET "rewardDistributedAt" = now(), "isActive" = false WHERE id = $1',
        [eventId],
      );

      console.log('Inserting audit');
      // Insert audit record (record executedBy when available)
      await queryRunner.manager.query(
        'INSERT INTO story_event_reward_distribution("storyEventId","executedBy","config","summary") VALUES ($1,$2,$3,$4)',
        [
          eventId,
          executedBy,
          JSON.stringify(rewardSpec),
          JSON.stringify({ perUserSummary }),
        ],
      );

      console.log('Committing transaction');
      await queryRunner.commitTransaction();
      return { distributed: distributedCount, summary: perUserSummary };
    } catch (err) {
      console.log('Transaction error', err);
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
