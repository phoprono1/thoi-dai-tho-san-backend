/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStat } from './user-stat.entity';
import { UserPowerService } from '../user-power/user-power.service';
import { User } from '../users/user.entity';
import { LevelsService } from '../levels/levels.service';
import { ItemSet } from '../items/item-set.entity';
import { Item } from '../items/item.entity';
import { UserItem } from '../user-items/user-item.entity';

@Injectable()
export class UserStatsService {
  constructor(
    @InjectRepository(UserStat)
    private userStatsRepository: Repository<UserStat>,
    private readonly userPowerService: UserPowerService,
    private readonly levelsService: LevelsService,
    @InjectRepository(UserItem)
    private readonly userItemRepository: Repository<UserItem>,
  ) {}

  // Centralized recompute: compose base + totalLevelStats + class-derived + items
  // This ensures we always compute derived fields (maxHp/attack/defense) the same way
  // and persist user_power afterwards.
  async recomputeAndPersistForUser(
    userId: number,
    options?: {
      baseStats?: { maxHp: number; attack: number; defense: number };
      fillCurrentHp?: boolean; // when true, set currentHp = maxHp after recompute
    },
  ): Promise<UserStat | null> {
    // Load current user stat and related lightweight data (including user relation)
    const userStats = await this.findByUserId(userId);
    if (!userStats) return null;

    // Base stats default if not provided
    const base = options?.baseStats || { maxHp: 100, attack: 10, defense: 5 };

    // Get authoritative level totals (additive) from LevelsService if possible
    let totalLevelStats = { maxHp: 0, attack: 0, defense: 0 };
    try {
      // Prefer the loaded user relation, but if it's missing (some rows may
      // not have the relation hydrated in certain code paths or during
      // incremental migrations), fetch the authoritative user row to read
      // the current level. Falling back to 0 would cause totalLevelStats to
      // be zero and can incorrectly wipe level bonuses during recompute.
      let userLevel = userStats.user?.level;
      if (typeof userLevel !== 'number' || Number.isNaN(userLevel)) {
        // fetch user row explicitly
        try {
          const u = await this.userStatsRepository.manager.findOne(User, {
            where: { id: userId },
            select: ['id', 'level'],
          });
          userLevel = u?.level || 0;
        } catch (fetchErr) {
          // if even this fails, treat as 0 but log in dev
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              '[UserStats] Failed to fetch user level for recompute',
              fetchErr,
            );
          }
          userLevel = 0;
        }
      }

      if (userLevel && this.levelsService) {
        totalLevelStats =
          await this.levelsService.getTotalLevelStats(userLevel);
      }
    } catch (err) {
      // fallback to zero totals
      totalLevelStats = { maxHp: 0, attack: 0, defense: 0 };
    }

    // Compute equipped items aggregate stats (raw stats + upgradeStats + set bonuses)
    const STAT_KEYS = [
      'attack',
      'defense',
      'hp',
      'critRate',
      'critDamage',
      'comboRate',
      'counterRate',
      'lifesteal',
      'armorPen',
      'dodgeRate',
      'accuracy',
      'strength',
      'intelligence',
      'dexterity',
      'vitality',
      'luck',
    ];

    const itemsStats: Record<string, number> = {};
    STAT_KEYS.forEach((k) => (itemsStats[k] = 0));

    // Track equipped items and sets (declare setsMap here so we can log diagnostics later)
    let setsMap: Record<number, { set: ItemSet; count: number }> = {};
    try {
      const equipped: UserItem[] = await this.userItemRepository.find({
        where: { userId, isEquipped: true },
        relations: ['item', 'item.itemSet'],
      });
      setsMap = {};
      (equipped || []).forEach((ui: UserItem) => {
        const it = ui.item;
        const its = (it?.stats || {}) as Record<string, number>;
        const up = (ui.upgradeStats || {}) as Record<string, number>;
        STAT_KEYS.forEach((k) => {
          itemsStats[k] += Number(its[k] || 0) + Number(up[k] || 0);
        });
        const set = (it as Item & { itemSet?: ItemSet })?.itemSet;
        if (set && set.id) {
          if (!setsMap[set.id]) setsMap[set.id] = { set, count: 0 };
          setsMap[set.id].count++;
        }
      });

      // Apply best set bonuses per set into itemsStats
      interface SetBonus {
        pieces: number;
        type?: string;
        stats?: Record<string, number>;
      }
      Object.values(setsMap).forEach(({ set, count }) => {
        const bonuses: SetBonus[] = (set.setBonuses as SetBonus[]) || [];
        let best: SetBonus | null = null;
        bonuses.forEach((b) => {
          if (!b || typeof b.pieces !== 'number') return;
          if (b.pieces <= count) {
            if (!best || b.pieces > best.pieces) best = b;
          }
        });
        if (!best) return;
        const stats = best.stats || {};
        const btype = (best.type || 'flat').toString();
        Object.entries(stats).forEach(([statKey, val]) => {
          const num = Number(val || 0);
          if (Number.isNaN(num) || num === 0) return;
          if (btype === 'flat') {
            itemsStats[statKey] = (itemsStats[statKey] || 0) + num;
          } else {
            // percentage applied on top of existing items stats for that key
            const baseVal = itemsStats[statKey] || 0;
            itemsStats[statKey] = Math.floor(baseVal + (baseVal * num) / 100);
          }
        });
      });
    } catch (err) {
      // best-effort: if items aggregation fails, treat as no items
    }

    // Fallback: if repository.find returned no item stats but there are user_item rows,
    // try a raw SQL join to ensure we pick up items even in tricky transactional contexts.
    try {
      const hasUserItems = await this.userItemRepository.count({
        where: { userId, isEquipped: true },
      });
      if (hasUserItems && (itemsStats['attack'] || 0) === 0) {
        // re-query via manager to be resilient to relation-loading issues
        const rows: Array<{
          upgrade_stats: any;
          stats: any;
          set_id: number | null;
        }> = await this.userItemRepository.manager.query(
          `SELECT ui.upgrade_stats, i.stats, i.set_id FROM user_item ui JOIN item i ON i.id = ui.item_id WHERE ui.user_id = $1 AND ui.is_equipped = true`,
          [userId],
        );
        // reset itemsStats and setsMap and re-accumulate
        STAT_KEYS.forEach((k) => (itemsStats[k] = 0));
        setsMap = {};
        (rows || []).forEach((r) => {
          const its = (r.stats || {}) as Record<string, number>;
          const up = (r.upgrade_stats || {}) as Record<string, number>;
          STAT_KEYS.forEach((k) => {
            itemsStats[k] += Number(its[k] || 0) + Number(up[k] || 0);
          });
          const sid = r.set_id || null;
          if (sid) {
            if (!setsMap[sid])
              setsMap[sid] = { set: undefined as unknown as ItemSet, count: 0 };
            setsMap[sid].count++;
          }
        });

        // try to load set rows for any set ids we found
        const setIds = Object.keys(setsMap)
          .map((s) => Number(s))
          .filter(Boolean);
        if (setIds.length > 0) {
          const sets = await this.userItemRepository.manager.findByIds(
            ItemSet,
            setIds,
          );
          sets.forEach((st) => {
            if (setsMap[st.id]) setsMap[st.id].set = st;
          });
        }
        // apply set bonuses (same logic as above)
        Object.values(setsMap).forEach(({ set, count }) => {
          if (!set) return;
          const bonuses: any[] = (set.setBonuses as any[]) || [];
          type Bonus = {
            pieces?: number;
            type?: string;
            stats?: Record<string, number>;
          };
          let best: Bonus | null = null;
          bonuses.forEach((b: unknown) => {
            const bonus = b as Bonus;
            if (!bonus || typeof bonus.pieces !== 'number') return;
            if (bonus.pieces <= count) {
              if (!best || bonus.pieces > best.pieces) best = b;
            }
          });
          if (!best) return;
          const stats = best.stats || {};
          const btype = (best.type || 'flat').toString();
          Object.entries(stats).forEach(([statKey, val]) => {
            const num = Number(val || 0);
            if (Number.isNaN(num) || num === 0) return;
            if (btype === 'flat') {
              itemsStats[statKey] = (itemsStats[statKey] || 0) + num;
            } else {
              const baseVal = itemsStats[statKey] || 0;
              itemsStats[statKey] = Math.floor(baseVal + (baseVal * num) / 100);
            }
          });
        });
      }
      // Additional case: if repository.find returned item stats but no sets were detected
      // (possible when relations not loaded), run the same raw-query fallback to collect set ids
      if (hasUserItems && Object.keys(setsMap).length === 0) {
        const rows2: Array<{
          set_id: number | null;
          stats: unknown;
          upgrade_stats: unknown;
        }> = await this.userItemRepository.manager.query(
          `SELECT ui.upgrade_stats, i.stats, i.set_id FROM user_item ui JOIN item i ON i.id = ui.item_id WHERE ui.user_id = $1 AND ui.is_equipped = true`,
          [userId],
        );
        const setIds2 = rows2.map((r) => r.set_id).filter((s) => Number(s));
        if (setIds2.length > 0) {
          const sets = await this.userItemRepository.manager.findByIds(
            ItemSet,
            setIds2,
          );
          sets.forEach((st) => {
            if (!setsMap[st.id]) setsMap[st.id] = { set: st, count: 0 };
            // count occurrences from rows2
            const count = rows2.filter(
              (r) => Number(r.set_id) === st.id,
            ).length;
            setsMap[st.id].count = count;
          });

          // apply set bonuses
          Object.values(setsMap).forEach(({ set, count }) => {
            if (!set) return;
            const bonuses = (set.setBonuses || []) as Array<{
              pieces: number;
              type?: string;
              stats?: Record<string, number>;
            }>;
            let best: {
              pieces: number;
              type?: string;
              stats?: Record<string, number>;
            } | null = null;
            bonuses.forEach((b) => {
              if (!b || typeof b.pieces !== 'number') return;
              if (b.pieces <= count) {
                if (!best || b.pieces > best.pieces) best = b;
              }
            });
            if (!best) return;
            const stats = best.stats || {};
            const btype = (best.type || 'flat').toString();
            Object.entries(stats).forEach(([statKey, val]) => {
              const num = Number(val || 0);
              if (Number.isNaN(num) || num === 0) return;
              if (btype === 'flat') {
                itemsStats[statKey] = (itemsStats[statKey] || 0) + num;
              } else {
                const baseVal = itemsStats[statKey] || 0;
                itemsStats[statKey] = Math.floor(
                  baseVal + (baseVal * num) / 100,
                );
              }
            });
          });
        }
      }
    } catch (e) {
      // ignore fallback errors; we already have best-effort above
    }

    // Get class bonuses from user.characterClass.statBonuses
    const classBonuses =
      (userStats.user?.characterClass?.statBonuses as Record<string, number>) ||
      {};

    // Compute attributes: class bonuses + item bonuses
    const strength = (classBonuses.strength || 0) + (itemsStats.strength || 0);
    const vitality = (classBonuses.vitality || 0) + (itemsStats.vitality || 0);
    const intelligence =
      (classBonuses.intelligence || 0) + (itemsStats.intelligence || 0);
    const dexterity =
      (classBonuses.dexterity || 0) + (itemsStats.dexterity || 0);
    const luck = (classBonuses.luck || 0) + (itemsStats.luck || 0);

    // Compute class-derived base from attributes
    const baseAttackFromClass = Math.floor(strength * 2);
    const baseDefenseFromClass = Math.floor(vitality * 1.5);
    const baseMaxHpFromClass = Math.floor(vitality * 10);

    // Recompute authoritative totals: base + totalLevelStats + class-derived + item contributions
    const newAttack =
      (base.attack || 0) +
      (totalLevelStats.attack || 0) +
      baseAttackFromClass +
      (itemsStats['attack'] || 0);
    const newDefense =
      (base.defense || 0) +
      (totalLevelStats.defense || 0) +
      baseDefenseFromClass +
      (itemsStats['defense'] || 0);
    const newMaxHp =
      (base.maxHp || 0) +
      (totalLevelStats.maxHp || 0) +
      baseMaxHpFromClass +
      (itemsStats['hp'] || 0);

    // Diagnostic logging (guarded by env var)
    const prevAttack = userStats.attack || 0;
    const prevDefense = userStats.defense || 0;

    if (
      process.env.DEBUG_RECOMPUTE === '1' ||
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG === 'recompute'
    ) {
      try {
        const setsCounts = Object.fromEntries(
          Object.entries(setsMap).map(([k, v]) => [k, v.count]),
        );
        console.warn('[UserStats:recompute-debug]', {
          userId,
          userLevel: userStats.user?.level,
          totalLevelStats,
          base,
          classBonuses,
          baseAttackFromClass,
          baseDefenseFromClass,
          itemsAttack: itemsStats['attack'],
          itemsDefense: itemsStats['defense'],
          setsCounts,
          prevAttack,
          computedAttack: newAttack,
          prevDefense,
          computedDefense: newDefense,
          computedMaxHp: newMaxHp,
        });
      } catch (e) {
        // best effort logging
      }
    }

    userStats.attack = Math.max(0, newAttack);
    userStats.defense = Math.max(0, newDefense);

    // Remember previous currentHp so we don't overwrite the player's HP during backfill.
    const prevMaxHp = userStats.maxHp || 0;
    const prevCurrentHp =
      typeof userStats.currentHp === 'number' ? userStats.currentHp : null;

    userStats.maxHp = Math.max(1, newMaxHp);

    // Update attributes with class + items
    userStats.strength = Math.max(0, strength);
    userStats.vitality = Math.max(0, vitality);
    userStats.intelligence = Math.max(0, intelligence);
    userStats.dexterity = Math.max(0, dexterity);
    userStats.luck = Math.max(0, luck);

    // Update other stats from items only
    userStats.critRate = Math.max(0, itemsStats['critRate'] || 0);
    userStats.critDamage = Math.max(0, itemsStats['critDamage'] || 0);
    userStats.comboRate = Math.max(0, itemsStats['comboRate'] || 0);
    userStats.counterRate = Math.max(0, itemsStats['counterRate'] || 0);
    userStats.lifesteal = Math.max(0, itemsStats['lifesteal'] || 0);
    userStats.armorPen = Math.max(0, itemsStats['armorPen'] || 0);
    userStats.dodgeRate = Math.max(0, itemsStats['dodgeRate'] || 0);
    userStats.accuracy = Math.max(0, itemsStats['accuracy'] || 0);

    // Adjust currentHp: preserve previous proportion of maxHp where possible
    if (options && options.fillCurrentHp) {
      // Admin requested full heal after recompute
      userStats.currentHp = userStats.maxHp;
    } else if (prevCurrentHp === null || typeof prevCurrentHp !== 'number') {
      // Unknown previous HP -> set to full max
      userStats.currentHp = userStats.maxHp;
    } else {
      // If previously had HP, preserve it but clamp to new max if needed
      userStats.currentHp = Math.min(prevCurrentHp, userStats.maxHp);
      if (userStats.currentHp < 1) userStats.currentHp = 1;
    }

    await this.userStatsRepository.save(userStats);

    try {
      if (userStats.userId) {
        await this.userPowerService.computeAndSaveForUser(userStats.userId);
      }
    } catch {
      // best-effort
    }

    return userStats;
  }

  findAll(): Promise<UserStat[]> {
    return this.userStatsRepository.find({ relations: ['user'] });
  }

  findOne(id: number): Promise<UserStat | null> {
    return this.userStatsRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  findByUserId(userId: number): Promise<UserStat | null> {
    return this.userStatsRepository.findOne({
      where: { userId },
      relations: ['user', 'user.characterClass'],
    });
  }

  async create(userStat: Partial<UserStat>): Promise<UserStat> {
    const newUserStat = this.userStatsRepository.create(userStat);
    const saved = await this.userStatsRepository.save(newUserStat);
    // Ensure user_power exists for new user stat
    try {
      if (saved.userId) {
        await this.userPowerService.computeAndSaveForUser(saved.userId);
      }
    } catch {
      // best-effort: don't fail create if compute fails
    }
    return saved;
  }

  async update(
    id: number,
    userStat: Partial<UserStat>,
  ): Promise<UserStat | null> {
    await this.userStatsRepository.update(id, userStat);
    const s = await this.findOne(id);
    try {
      if (s && s.userId) {
        await this.userPowerService.computeAndSaveForUser(s.userId);
      }
    } catch {
      // continue
    }
    return s;
  }

  async remove(id: number): Promise<void> {
    await this.userStatsRepository.delete(id);
  }

  // Reset và tính lại toàn bộ stats từ đầu (cho trường hợp cần sync)
  async recalculateTotalStats(
    userId: number,
    totalLevelStats: {
      maxHp: number;
      attack: number;
      defense: number;
    },
    baseStats: {
      maxHp: number;
      attack: number;
      defense: number;
    },
  ): Promise<UserStat | null> {
    const userStats = await this.findByUserId(userId);
    if (!userStats) return null;

    // Reset về base stats + total level stats
    userStats.maxHp = baseStats.maxHp + totalLevelStats.maxHp;
    userStats.attack = baseStats.attack + totalLevelStats.attack;
    userStats.defense = baseStats.defense + totalLevelStats.defense;

    // Hồi đầy HP khi recalculate
    userStats.currentHp = userStats.maxHp;

    await this.userStatsRepository.save(userStats);
    try {
      if (userStats.userId) {
        await this.userPowerService.computeAndSaveForUser(userStats.userId);
      }
    } catch {
      // continue
    }
    return userStats;
  }
}
