/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserItem } from './user-item.entity';
import { UpgradeLog, UpgradeResult } from './upgrade-log.entity';
import { User } from '../users/user.entity';
import { Item } from '../items/item.entity';
import { ItemSet } from '../items/item-set.entity';
import { ItemType, ConsumableType } from '../items/item-types.enum';
import { UserStatsService } from '../user-stats/user-stats.service';
import { UsersService } from '../users/users.service';
import { computeCombatPowerFromStats } from '../user-power/computeCombatPower';
import { UserPower } from '../user-power/user-power.entity';
import { DataSource } from 'typeorm';

@Injectable()
export class UserItemsService {
  constructor(
    @InjectRepository(UserItem)
    private userItemsRepository: Repository<UserItem>,
    @InjectRepository(UpgradeLog)
    private upgradeLogsRepository: Repository<UpgradeLog>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
    private readonly userStatsService: UserStatsService,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  findAll(): Promise<UserItem[]> {
    return this.userItemsRepository.find({ relations: ['user', 'item'] });
  }

  findOne(id: number): Promise<UserItem | null> {
    return this.userItemsRepository.findOne({
      where: { id },
      relations: ['user', 'item'],
    });
  }

  findByUserId(userId: number): Promise<UserItem[]> {
    return this.userItemsRepository.find({
      where: { userId },
      relations: ['item'],
    });
  }

  findByUserAndItem(userId: number, itemId: number): Promise<UserItem | null> {
    return this.userItemsRepository.findOne({
      where: { userId, itemId },
      relations: ['user', 'item'],
    });
  }

  async create(userItem: Partial<UserItem>): Promise<UserItem> {
    const newUserItem = this.userItemsRepository.create(userItem);
    return this.userItemsRepository.save(newUserItem);
  }

  async update(
    id: number,
    userItem: Partial<UserItem>,
  ): Promise<UserItem | null> {
    await this.userItemsRepository.update(id, userItem);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.userItemsRepository.delete(id);
  }

  async addItemToUser(
    userId: number,
    itemId: number,
    quantity: number = 1,
  ): Promise<UserItem> {
    // Kiểm tra xem user đã có item này chưa
    const existingUserItem = await this.findByUserAndItem(userId, itemId);

    if (existingUserItem) {
      // Nếu đã có, tăng quantity
      existingUserItem.quantity += quantity;
      return this.userItemsRepository.save(existingUserItem);
    } else {
      // Nếu chưa có, tạo mới
      return this.create({
        userId,
        itemId,
        quantity,
      });
    }
  }

  async removeItemFromUser(
    userId: number,
    itemId: number,
    quantity: number = 1,
  ): Promise<boolean> {
    const userItem = await this.findByUserAndItem(userId, itemId);

    if (!userItem) {
      return false; // Không có item để xóa
    }

    if (userItem.quantity <= quantity) {
      // Nếu quantity <= số lượng cần xóa, xóa luôn item
      await this.userItemsRepository.delete(userItem.id);
    } else {
      // Nếu quantity > số lượng cần xóa, giảm quantity
      userItem.quantity -= quantity;
      await this.userItemsRepository.save(userItem);
    }

    return true;
  }

  // ===== WEAPON UPGRADE SYSTEM =====

  async getUpgradeInfo(userItemId: number) {
    const userItem = await this.findOne(userItemId);
    if (!userItem) {
      throw new BadRequestException('Item không tồn tại');
    }

    if (userItem.upgradeLevel >= userItem.maxUpgradeLevel) {
      throw new BadRequestException('Item đã đạt cấp tối đa');
    }

    const nextLevel = userItem.upgradeLevel + 1;
    const cost = this.calculateUpgradeCost(userItem.upgradeLevel);
    const baseSuccessRate = this.calculateBaseSuccessRate(
      userItem.upgradeLevel,
    );

    return {
      userItem,
      nextLevel,
      cost,
      baseSuccessRate,
      canUpgrade: true,
    };
  }

  async upgradeWeapon(userItemId: number, useLuckyCharm: boolean = false) {
    const userItem = await this.findOne(userItemId);
    if (!userItem) {
      throw new BadRequestException('Item không tồn tại');
    }

    if (userItem.upgradeLevel >= userItem.maxUpgradeLevel) {
      throw new BadRequestException('Item đã đạt cấp tối đa');
    }

    // Kiểm tra user có đủ vàng không
    const user = await this.usersRepository.findOne({
      where: { id: userItem.userId },
    });

    if (!user) {
      throw new BadRequestException('Người chơi không tồn tại');
    }

    const cost = this.calculateUpgradeCost(userItem.upgradeLevel);
    if (user.gold < cost) {
      throw new BadRequestException('Không đủ vàng để nâng cấp vũ khí');
    }

    // Kiểm tra và sử dụng lucky charm nếu có
    let luckyCharmsUsed = 0;
    if (useLuckyCharm) {
      // Tìm Lucky Charm theo tên thay vì hard-coded ID
      const luckyCharmItem = await this.itemsRepository.findOne({
        where: { name: 'Lucky Charm' },
      });
      if (!luckyCharmItem) {
        throw new BadRequestException(
          'Vật phẩm bùa may mắn không tồn tại trong hệ thống',
        );
      }

      const luckyCharm = await this.findByUserAndItem(
        userItem.userId,
        luckyCharmItem.id,
      );
      if (!luckyCharm || luckyCharm.quantity <= 0) {
        throw new BadRequestException('Không có bùa may mắn');
      }
      luckyCharm.quantity -= 1;
      await this.userItemsRepository.save(luckyCharm);
      luckyCharmsUsed = 1;
    }

    // Tính tỷ lệ thành công
    const baseSuccessRate = this.calculateBaseSuccessRate(
      userItem.upgradeLevel,
    );
    const finalSuccessRate = Math.min(
      100,
      baseSuccessRate + luckyCharmsUsed * 20,
    ); // +20% per lucky charm

    // Roll for success
    const roll = Math.random() * 100;
    const isSuccess = roll < finalSuccessRate;

    // Determine result
    let result: UpgradeResult;
    let newLevel = userItem.upgradeLevel;

    if (isSuccess) {
      // Success - increase level
      newLevel = userItem.upgradeLevel + 1;
      userItem.upgradeLevel = newLevel;

      // Apply upgrade bonus
      const statsBonus = this.calculateUpgradeBonus(
        userItem.item,
        userItem.upgradeLevel,
      );
      userItem.upgradeStats = {
        ...userItem.upgradeStats,
        ...statsBonus,
      };

      result = UpgradeResult.SUCCESS;
    } else {
      // Failed - lose gold but keep level
      result = UpgradeResult.FAILED;
    }

    // Deduct gold
    user.gold -= cost;
    await this.usersRepository.save(user);

    // Save updated user item
    await this.userItemsRepository.save(userItem);

    // Log upgrade attempt
    const upgradeLog = this.upgradeLogsRepository.create({
      userItemId,
      userId: userItem.userId,
      previousLevel: userItem.upgradeLevel - (isSuccess ? 1 : 0),
      targetLevel: newLevel,
      result,
      cost,
      luckyCharmsUsed,
      successRate: finalSuccessRate,
      statsBonus: isSuccess
        ? this.calculateUpgradeBonus(userItem.item, newLevel)
        : undefined,
    });
    await this.upgradeLogsRepository.save(upgradeLog);

    return {
      success: isSuccess,
      newLevel,
      cost,
      luckyCharmsUsed,
      finalSuccessRate,
      roll,
      userItem,
      statsBonus: isSuccess ? userItem.upgradeStats : null,
    };
  }

  private calculateUpgradeCost(currentLevel: number): number {
    // Chi phí tăng theo cấp số nhân: cơ bản 100 vàng, hệ số 1.5 mỗi cấp
    return Math.floor(100 * Math.pow(1.5, currentLevel));
  }

  private calculateBaseSuccessRate(currentLevel: number): number {
    // Tỷ lệ thành công giảm theo cấp: 90% ở cấp 0, xuống còn 10% ở cấp 10
    const maxLevel = 10;
    const minRate = 10;
    const maxRate = 90;
    const rateDecrease = (maxRate - minRate) / maxLevel;

    return Math.max(minRate, maxRate - currentLevel * rateDecrease);
  }

  private calculateUpgradeBonus(item: Item, level: number) {
    // Chỉ số cơ bản tăng mỗi cấp (theo độ hiếm của item)
    const rarityMultiplier = item.rarity || 1;
    const levelMultiplier = level * 0.1; // 10% tăng mỗi cấp

    const bonus = {
      attack: Math.floor(
        (item.stats?.attack || 0) * levelMultiplier * rarityMultiplier,
      ),
      defense: Math.floor(
        (item.stats?.defense || 0) * levelMultiplier * rarityMultiplier,
      ),
      critRate: Math.floor((item.stats?.critRate || 0) * levelMultiplier),
      critDamage: Math.floor((item.stats?.critDamage || 0) * levelMultiplier),
      comboRate: Math.floor((item.stats?.comboRate || 0) * levelMultiplier),
      counterRate: Math.floor((item.stats?.counterRate || 0) * levelMultiplier),
      lifesteal: Math.floor((item.stats?.lifesteal || 0) * levelMultiplier),
      armorPen: Math.floor((item.stats?.armorPen || 0) * levelMultiplier),
      dodgeRate: Math.floor((item.stats?.dodgeRate || 0) * levelMultiplier),
      accuracy: Math.floor((item.stats?.accuracy || 0) * levelMultiplier),
    };

    // Remove zero values
    Object.keys(bonus).forEach((key) => {
      if (bonus[key] === 0) {
        delete bonus[key];
      }
    });

    return bonus;
  }

  async getUpgradeHistory(userItemId: number) {
    return this.upgradeLogsRepository.find({
      where: { userItemId },
      order: { createdAt: 'DESC' },
    });
  }

  async equipItem(userItemId: number, equip: boolean) {
    const userItem = await this.findOne(userItemId);
    if (!userItem) {
      throw new BadRequestException('Vật phẩm không tồn tại');
    }

    // Enforce class/level restrictions only when equipping (not when unequipping)
    if (equip) {
      try {
        const item = userItem.item;
        const classRestrictions = item.classRestrictions || {};
        if (classRestrictions.requiredLevel) {
          const u = await this.usersRepository.findOne({
            where: { id: userItem.userId },
            relations: ['characterClass'],
          });
          if (u && u.level < classRestrictions.requiredLevel) {
            throw new BadRequestException(
              'Cấp độ của bạn chưa đủ để trang bị vật phẩm này',
            );
          }
        }

        if (
          classRestrictions.requiredTier ||
          classRestrictions.allowedClassTypes ||
          classRestrictions.restrictedClassTypes
        ) {
          const u = await this.usersRepository.findOne({
            where: { id: userItem.userId },
            relations: ['characterClass'],
          });
          if (u && u.characterClass) {
            const userTier = u.characterClass.tier;
            const userType = u.characterClass.type;
            if (
              classRestrictions.requiredTier &&
              userTier < classRestrictions.requiredTier
            ) {
              throw new BadRequestException(
                'Cấp bậc class của bạn chưa đủ để trang bị vật phẩm này',
              );
            }
            if (
              Array.isArray(classRestrictions.allowedClassTypes) &&
              classRestrictions.allowedClassTypes.length > 0 &&
              !classRestrictions.allowedClassTypes.includes(userType)
            ) {
              throw new BadRequestException(
                'Lớp nhân vật của bạn không được phép trang bị vật phẩm này',
              );
            }
            if (
              Array.isArray(classRestrictions.restrictedClassTypes) &&
              classRestrictions.restrictedClassTypes.length > 0 &&
              classRestrictions.restrictedClassTypes.includes(userType)
            ) {
              throw new BadRequestException(
                'Lớp nhân vật của bạn bị hạn chế sử dụng vật phẩm này',
              );
            }
          }
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        // ignore and continue if anything else goes wrong with restriction checks
      }
    }

    // Fetch current user stats and equipped items BEFORE making changes so we can
    // preserve level-based contributions when recalculating derived stats.
    const userStatsBefore = await this.userStatsService.findByUserId(
      userItem.userId,
    );
    const equippedBefore = await this.getEquippedItems(userItem.userId);

    // Nếu equip = true, unequip tất cả items cùng loại trước
    if (equip) {
      // Cannot use relation objects in Repository.update criteria because
      // UpdateQueryBuilder can't resolve relation aliases (error seen in logs).
      // Instead, find currently equipped items for the user, filter by item.type
      // and save the updated entities.
      const currentlyEquipped = await this.userItemsRepository.find({
        where: { userId: userItem.userId, isEquipped: true },
        relations: ['item'],
      });

      const toUnequip = currentlyEquipped.filter(
        (ui) => ui.item && ui.item.type === userItem.item.type,
      );
      if (toUnequip.length > 0) {
        toUnequip.forEach((ui) => (ui.isEquipped = false));
        await this.userItemsRepository.save(toUnequip);
      }
    }

    // Apply equip/unequip and persist
    userItem.isEquipped = equip;
    const saved = await this.userItemsRepository.save(userItem);

    // Recalculate and persist derived stats while preserving level-up contributions.
    try {
      const userStats = userStatsBefore; // already fetched prior to changes
      if (userStats) {
        // Sum item stats before the change (used to compute level-only contribution and to remove previous item contributions)
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

        // Set bonus shape used by item sets
        interface SetBonus {
          pieces: number;
          type?: string;
          stats?: Record<string, number>;
          description?: string;
        }

        const prevItemsStats: Record<string, number> = {};
        STAT_KEYS.forEach((k) => (prevItemsStats[k] = 0));
        equippedBefore.forEach((ui) => {
          const it = ui.item;
          const its = (it?.stats || {}) as Record<string, number>;
          const up = (ui.upgradeStats || {}) as Record<string, number>;
          STAT_KEYS.forEach((k) => {
            prevItemsStats[k] += Number(its[k] || 0) + Number(up[k] || 0);
          });
        });

        // Include previously active set bonuses into prevItemsStats so they are
        // removed correctly when recalculating. Use the single best bonus per set
        // (the bonus with the highest `pieces` threshold <= equipped count).
        const prevSetsMap: Record<number, { set: ItemSet; count: number }> = {};
        equippedBefore.forEach((ui) => {
          const set = (ui.item as Item & { itemSet?: ItemSet }).itemSet;
          if (set && set.id) {
            if (!prevSetsMap[set.id]) prevSetsMap[set.id] = { set, count: 0 };
            prevSetsMap[set.id].count++;
          }
        });

        const prevSetFlat: Record<string, number> = {};
        const prevSetPercent: Record<string, number> = {};
        STAT_KEYS.forEach((k) => {
          prevSetFlat[k] = 0;
          prevSetPercent[k] = 0;
        });

        Object.values(prevSetsMap).forEach(({ set, count }) => {
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
              prevSetFlat[statKey] = (prevSetFlat[statKey] || 0) + num;
            } else {
              prevSetPercent[statKey] = (prevSetPercent[statKey] || 0) + num;
            }
          });
        });

        // Apply previous set flats and percents into prevItemsStats so subtraction will remove them
        Object.keys(prevSetFlat).forEach((k) => {
          prevItemsStats[k] = (prevItemsStats[k] || 0) + (prevSetFlat[k] || 0);
        });
        Object.keys(prevSetPercent).forEach((k) => {
          const pct = prevSetPercent[k] || 0;
          if (pct !== 0) {
            const baseVal = prevItemsStats[k] || 0;
            prevItemsStats[k] = Math.floor(baseVal + (baseVal * pct) / 100);
          }
        });

        // Aggregate equipped items for this user AFTER the save (current equipment)
        const equippedAfter = await this.getEquippedItems(userItem.userId);
        const itemsStats: Record<string, number> = {};
        STAT_KEYS.forEach((k) => (itemsStats[k] = 0));
        // Track set-based bonuses: flat additions and percentage multipliers
        const setFlat: Record<string, number> = {};
        const setPercent: Record<string, number> = {};
        STAT_KEYS.forEach((k) => {
          setFlat[k] = 0;
          setPercent[k] = 0;
        });

        // Sum raw item + upgrade stats
        equippedAfter.forEach((ui) => {
          const it = ui.item;
          const its = (it?.stats || {}) as Record<string, number>;
          const up = (ui.upgradeStats || {}) as Record<string, number>;
          STAT_KEYS.forEach((k) => {
            itemsStats[k] += Number(its[k] || 0) + Number(up[k] || 0);
          });
        });

        // Compute set bonuses based on equipped items per set
        interface SetBonus {
          pieces: number;
          type?: string;
          stats?: Record<string, number>;
          description?: string;
        }

        const setsMap: Record<number, { set: ItemSet; count: number }> = {};
        equippedAfter.forEach((ui) => {
          const set = (ui.item as Item & { itemSet?: ItemSet }).itemSet;
          if (set && set.id) {
            if (!setsMap[set.id]) setsMap[set.id] = { set, count: 0 };
            setsMap[set.id].count++;
          }
        });

        Object.values(setsMap).forEach(({ set, count }) => {
          const bonuses: SetBonus[] = (set.setBonuses as SetBonus[]) || [];
          bonuses.forEach((b) => {
            if (!b || typeof b.pieces !== 'number') return;
            if (count >= b.pieces) {
              const stats = b.stats || {};
              const btype = (b.type || 'flat').toString();
              Object.entries(stats).forEach(([statKey, val]) => {
                const num = Number(val || 0);
                if (Number.isNaN(num) || num === 0) return;
                if (btype === 'flat') {
                  setFlat[statKey] = (setFlat[statKey] || 0) + num;
                } else {
                  // percentage
                  setPercent[statKey] = (setPercent[statKey] || 0) + num;
                }
              });
            }
          });
        });

        // Apply flat set bonuses
        Object.keys(setFlat).forEach((k) => {
          itemsStats[k] = (itemsStats[k] || 0) + (setFlat[k] || 0);
        });

        // Apply percentage set bonuses (applied on top of itemsStats)
        Object.keys(setPercent).forEach((k) => {
          const pct = setPercent[k] || 0;
          if (pct !== 0) {
            const baseVal = itemsStats[k] || 0;
            const adjusted = Math.floor(baseVal + (baseVal * pct) / 100);
            itemsStats[k] = adjusted;
          }
        });

        // Compute base derived from class-related stats (strength/vitality)
        const classStrength = userStats.strength || 0;
        const classVitality = userStats.vitality || 0;

        const baseAttackFromClass = Math.floor(classStrength * 2);
        const baseDefenseFromClass = Math.floor(classVitality * 1.5);
        const baseMaxHpFromClass = Math.floor(classVitality * 10);

        // Derive level-only contributions by subtracting base and previous item bonuses from stored stats
        const userAttackVal = userStats.attack || 0;
        const userDefenseVal = userStats.defense || 0;
        const userMaxHpVal = userStats.maxHp || 0;

        const levelOnlyAttack = Math.max(
          0,
          userAttackVal - baseAttackFromClass - (prevItemsStats['attack'] || 0),
        );
        const levelOnlyDefense = Math.max(
          0,
          userDefenseVal -
            baseDefenseFromClass -
            (prevItemsStats['defense'] || 0),
        );
        const levelOnlyMaxHp = Math.max(
          0,
          userMaxHpVal - baseMaxHpFromClass - (prevItemsStats['hp'] || 0),
        );

        // New totals = base from class + level-only contributions + current item bonuses (including set bonuses)
        const newAttack =
          baseAttackFromClass + levelOnlyAttack + (itemsStats['attack'] || 0);
        const newDefense =
          baseDefenseFromClass +
          levelOnlyDefense +
          (itemsStats['defense'] || 0);
        const newMaxHp =
          baseMaxHpFromClass + levelOnlyMaxHp + (itemsStats['hp'] || 0);

        // Build payload for other stats: remove previous item contributions, add new item contributions
        const otherStatsUpdate: Record<string, number> = {};
        // Cast userStats so we can access arbitrary stat keys safely
        const userStatsRecord = userStats as unknown as Record<string, number>;
        STAT_KEYS.forEach((k) => {
          if (k === 'attack' || k === 'defense' || k === 'hp') return;
          const before = Number(userStatsRecord[k] || 0);
          const prev = prevItemsStats[k] || 0;
          const now = itemsStats[k] || 0;
          const updated = Math.max(0, before - prev + now);
          otherStatsUpdate[k] = updated;
        });

        // Persist updated derived stats; set currentHp to new max for consistency with recalc behavior
        await this.userStatsService.update(userStats.id, {
          attack: newAttack,
          defense: newDefense,
          maxHp: newMaxHp,
          currentHp: newMaxHp,
          // other stats
          critRate: otherStatsUpdate['critRate'],
          critDamage: otherStatsUpdate['critDamage'],
          comboRate: otherStatsUpdate['comboRate'],
          counterRate: otherStatsUpdate['counterRate'],
          lifesteal: otherStatsUpdate['lifesteal'],
          armorPen: otherStatsUpdate['armorPen'],
          dodgeRate: otherStatsUpdate['dodgeRate'],
          accuracy: otherStatsUpdate['accuracy'],
          strength: otherStatsUpdate['strength'],
          intelligence: otherStatsUpdate['intelligence'],
          dexterity: otherStatsUpdate['dexterity'],
          vitality: otherStatsUpdate['vitality'],
          luck: otherStatsUpdate['luck'],
        });

        // Ensure final recompute and user_power persist via centralized method
        try {
          if (this.userStatsService) {
            await this.userStatsService.recomputeAndPersistForUser(
              userItem.userId,
            );
          }
        } catch (err) {
          console.warn(
            'Failed to recompute/save user power after equip:',
            err?.message || err,
          );
        }
      }
    } catch (err) {
      // non-fatal: log and continue (do not block equip)
      console.error('Error recalculating stats after equip:', err);
    }

    return saved;
  }

  async getEquippedItems(userId: number) {
    return this.userItemsRepository.find({
      where: { userId, isEquipped: true },
      relations: ['item', 'item.itemSet'],
    });
  }

  // ===== CONSUMABLE ITEMS SYSTEM =====

  async useConsumableItem(userItemId: number): Promise<{
    success: boolean;
    message: string;
    effects?: any;
  }> {
    const userItem = await this.findOne(userItemId);
    if (!userItem) {
      throw new BadRequestException('Vật phẩm không tồn tại');
    }

    if (userItem.quantity <= 0) {
      throw new BadRequestException('Không còn vật phẩm để sử dụng');
    }

    const item = userItem.item;
    if (item.type !== ItemType.CONSUMABLE) {
      throw new BadRequestException(
        'Vật phẩm này không phải là vật phẩm tiêu thụ',
      );
    }

    // Enforce class/level restrictions for consumables as well
    try {
      const classRestrictions = item.classRestrictions || {};
      if (classRestrictions.requiredLevel) {
        const u = await this.usersRepository.findOne({
          where: { id: userItem.userId },
          relations: ['characterClass'],
        });
        if (u && u.level < classRestrictions.requiredLevel) {
          throw new BadRequestException(
            'Cấp độ của bạn chưa đủ để sử dụng vật phẩm này',
          );
        }
      }

      if (
        classRestrictions.requiredTier ||
        classRestrictions.allowedClassTypes ||
        classRestrictions.restrictedClassTypes
      ) {
        const u = await this.usersRepository.findOne({
          where: { id: userItem.userId },
          relations: ['characterClass'],
        });
        if (u && u.characterClass) {
          const userTier = u.characterClass.tier;
          const userType = u.characterClass.type;
          if (
            classRestrictions.requiredTier &&
            userTier < classRestrictions.requiredTier
          ) {
            throw new BadRequestException(
              'Cấp bậc class của bạn chưa đủ để sử dụng vật phẩm này',
            );
          }
          if (
            Array.isArray(classRestrictions.allowedClassTypes) &&
            classRestrictions.allowedClassTypes.length > 0 &&
            !classRestrictions.allowedClassTypes.includes(userType)
          ) {
            throw new BadRequestException(
              'Lớp nhân vật của bạn không được phép sử dụng vật phẩm này',
            );
          }
          if (
            Array.isArray(classRestrictions.restrictedClassTypes) &&
            classRestrictions.restrictedClassTypes.length > 0 &&
            classRestrictions.restrictedClassTypes.includes(userType)
          ) {
            throw new BadRequestException(
              'Lớp nhân vật của bạn bị hạn chế sử dụng vật phẩm này',
            );
          }
        }
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // ignore other errors
    }

    const user = await this.usersRepository.findOne({
      where: { id: userItem.userId },
    });
    if (!user) {
      throw new BadRequestException('Người chơi không tồn tại');
    }

    let result: { success: boolean; message: string; effects?: any } = {
      success: true,
      message: 'Đã sử dụng vật phẩm thành công',
    };

    // Xử lý theo loại consumable
    switch (item.consumableType) {
      case ConsumableType.HP_POTION:
        result = await this.useHpPotion(userItem, user);
        break;

      case ConsumableType.MP_POTION:
        result = await this.useMpPotion(userItem, user);
        break;

      case ConsumableType.EXP_POTION:
        result = await this.useExpPotion(userItem, user);
        break;

      case ConsumableType.STAT_BOOST:
        result = await this.useStatBoostPotion(userItem, user);
        break;

      default:
        throw new BadRequestException(
          'Loại vật phẩm tiêu thụ không được hỗ trợ',
        );
    }

    // Giảm quantity của item
    userItem.quantity -= 1;
    if (userItem.quantity <= 0) {
      await this.userItemsRepository.delete(userItem.id);
    } else {
      await this.userItemsRepository.save(userItem);
    }

    return result;
  }

  private async useHpPotion(
    userItem: UserItem,
    user: User,
  ): Promise<{ success: boolean; message: string; effects: any }> {
    const userStats = await this.userStatsService.findByUserId(user.id);
    if (!userStats) {
      throw new BadRequestException(
        'Không tìm thấy thông tin stats của người chơi',
      );
    }

    const healAmount = userItem.item.stats?.hp || 50; // Default 50 HP if not specified
    const oldHp = userStats.currentHp;
    userStats.currentHp = Math.min(
      userStats.maxHp,
      userStats.currentHp + healAmount,
    );

    await this.userStatsService.update(userStats.id, {
      currentHp: userStats.currentHp,
    });

    return {
      success: true,
      message: `Đã hồi ${userStats.currentHp - oldHp} HP`,
      effects: {
        healAmount: userStats.currentHp - oldHp,
        newHp: userStats.currentHp,
        maxHp: userStats.maxHp,
      },
    };
  }

  private useMpPotion(
    _userItem: UserItem,
    _user: User,
  ): Promise<{ success: boolean; message: string; effects: any }> {
    // MP system chưa được implement, tạm thời return success
    void _userItem;
    void _user;
    return Promise.resolve({
      success: true,
      message: 'Tính năng MP potion sẽ được cập nhật sau',
      effects: {
        mpRestored: 0,
      },
    });
  }

  private async useExpPotion(
    userItem: UserItem,
    user: User,
  ): Promise<{ success: boolean; message: string; effects: any }> {
    const expGain = userItem.item.consumableValue || 100; // Default 100 EXP if not specified
    const oldLevel = user.level;
    user.experience += expGain;
    await this.usersRepository.save(user);

    // Kiểm tra có level up không
    let leveledUp = false;
    let newLevel = oldLevel;

    try {
      await this.usersService.levelUpUser(user.id);
      const updatedUser = await this.usersRepository.findOne({
        where: { id: user.id },
      });
      if (updatedUser && updatedUser.level > oldLevel) {
        leveledUp = true;
        newLevel = updatedUser.level;
      }
    } catch {
      // Nếu không đủ exp để level up, không sao
    }

    return {
      success: true,
      message: `Đã nhận ${expGain} EXP${leveledUp ? ` và lên level ${newLevel}!` : ''}`,
      effects: {
        expGained: expGain,
        oldLevel,
        newLevel,
        leveledUp,
        totalExp: user.experience,
      },
    };
  }

  private async useStatBoostPotion(
    userItem: UserItem,
    user: User,
  ): Promise<{ success: boolean; message: string; effects: any }> {
    const userStats = await this.userStatsService.findByUserId(user.id);
    if (!userStats) {
      throw new BadRequestException(
        'Không tìm thấy thông tin stats của người chơi',
      );
    }

    const itemStats = userItem.item.stats || {};
    const statBoosts: Record<string, number> = {};

    const sStrength = Number(itemStats['strength']);
    if (!Number.isNaN(sStrength)) {
      userStats.strength += sStrength;
      statBoosts.strength = sStrength;
    }

    const sIntelligence = Number(itemStats['intelligence']);
    if (!Number.isNaN(sIntelligence)) {
      userStats.intelligence += sIntelligence;
      statBoosts.intelligence = sIntelligence;
    }

    const sDexterity = Number(itemStats['dexterity']);
    if (!Number.isNaN(sDexterity)) {
      userStats.dexterity += sDexterity;
      statBoosts.dexterity = sDexterity;
    }

    const sVitality = Number(itemStats['vitality']);
    if (!Number.isNaN(sVitality)) {
      userStats.vitality += sVitality;
      statBoosts.vitality = sVitality;
    }

    const sLuck = Number(itemStats['luck']);
    if (!Number.isNaN(sLuck)) {
      userStats.luck += sLuck;
      statBoosts.luck = sLuck;
    }

    // Recalculate total stats
    const baseStats = {
      maxHp: 100,
      attack: 10,
      defense: 5,
    };

    const totalLevelStats = {
      maxHp: userStats.maxHp - baseStats.maxHp,
      attack: userStats.attack - baseStats.attack,
      defense: userStats.defense - baseStats.defense,
    };

    await this.userStatsService.recalculateTotalStats(
      user.id,
      totalLevelStats,
      baseStats,
    );

    // After stat boost, recompute and persist user power
    try {
      const updatedStats = await this.userStatsService.findByUserId(user.id);
      const equippedForPower = await this.getEquippedItems(user.id);
      const power = computeCombatPowerFromStats(
        updatedStats || {},
        equippedForPower || [],
      );

      const existing = await this.dataSource.manager.findOne(UserPower, {
        where: { userId: user.id },
      });
      if (existing) {
        existing.combatPower = power;
        await this.dataSource.manager.save(UserPower, existing);
      } else {
        const np = this.dataSource.manager.create(UserPower, {
          userId: user.id,
          combatPower: power,
        });
        await this.dataSource.manager.save(UserPower, np);
      }
    } catch (err) {
      console.warn(
        'Failed to compute/save user power after stat boost:',
        err?.message || err,
      );
    }

    const boostMessages = Object.entries(statBoosts)
      .map(([stat, value]) => `${stat}: +${value}`)
      .join(', ');

    return {
      success: true,
      message: `Đã tăng các chỉ số: ${boostMessages}`,
      effects: {
        statBoosts,
        newStats: {
          strength: userStats.strength,
          intelligence: userStats.intelligence,
          dexterity: userStats.dexterity,
          vitality: userStats.vitality,
          luck: userStats.luck,
        },
      },
    };
  }
}
