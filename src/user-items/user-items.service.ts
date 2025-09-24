/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserItem } from './user-item.entity';
import { UpgradeLog, UpgradeResult } from './upgrade-log.entity';
import { User } from '../users/user.entity';
import { Item } from '../items/item.entity';
import { ItemType, ConsumableType } from '../items/item-types.enum';
import { UserStatsService } from '../user-stats/user-stats.service';
import { UsersService } from '../users/users.service';
import { UserStaminaService } from '../user-stamina/user-stamina.service';
import { computeCombatPowerFromStats } from '../user-power/computeCombatPower';
import { UserPower } from '../user-power/user-power.entity';
import { DataSource } from 'typeorm';
import { ClassType } from '../character-classes/character-class.entity';
import { deriveCombatStats } from '../combat-engine/stat-converter';

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
    @Inject(forwardRef(() => UserStatsService))
    private readonly userStatsService: UserStatsService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly userStaminaService: UserStaminaService,
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

    // Calculate derived stats from item's core attributes for upgrade bonus
    const itemDerivedStats = deriveCombatStats({
      baseAttack: 0,
      baseMaxHp: 0,
      baseDefense: 0,
      ...item.stats,
    });

    const bonus = {
      attack: Math.floor(
        (itemDerivedStats.attack || 0) * levelMultiplier * rarityMultiplier,
      ),
      defense: Math.floor(
        (itemDerivedStats.defense || 0) * levelMultiplier * rarityMultiplier,
      ),
      maxHp: Math.floor(
        (itemDerivedStats.maxHp || 0) * levelMultiplier * rarityMultiplier,
      ),
      // Core attributes are not multiplied for upgrades - they stay as base bonuses
      strength: item.stats?.strength || 0,
      intelligence: item.stats?.intelligence || 0,
      dexterity: item.stats?.dexterity || 0,
      vitality: item.stats?.vitality || 0,
      luck: item.stats?.luck || 0,
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
              // Check if user type has equivalent types (e.g., knight = tank, priest = healer)
              const equivalentTypes = this.getEquivalentClassTypes(userType);
              const hasAllowedType = equivalentTypes.some((type) =>
                classRestrictions.allowedClassTypes.includes(type as ClassType),
              );
              if (!hasAllowedType) {
                throw new BadRequestException(
                  'Lớp nhân vật của bạn không được phép trang bị vật phẩm này',
                );
              }
            }
            if (
              Array.isArray(classRestrictions.restrictedClassTypes) &&
              classRestrictions.restrictedClassTypes.length > 0 &&
              classRestrictions.restrictedClassTypes.includes(userType)
            ) {
              // Check if user type has equivalent types that are restricted
              const equivalentTypes = this.getEquivalentClassTypes(userType);
              const isRestricted = equivalentTypes.some((type) =>
                classRestrictions.restrictedClassTypes.includes(
                  type as ClassType,
                ),
              );
              if (isRestricted) {
                throw new BadRequestException(
                  'Lớp nhân vật của bạn bị hạn chế sử dụng vật phẩm này',
                );
              }
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
    // Note: These are no longer needed since we use core-only attributes

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

    // Stats are now calculated on-demand from core attributes, no need to recompute
    // The complex stat recalculation logic has been removed since we use core-only attributes

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

    // Calculate max HP using the same method as updateHpToMax
    const totalStats = await this.userStatsService.getTotalStatsWithAllBonuses(
      user.id,
    );
    const derivedStats = deriveCombatStats({
      baseAttack: 10,
      baseMaxHp: 100,
      baseDefense: 5,
      STR: totalStats.str,
      INT: totalStats.int,
      DEX: totalStats.dex,
      VIT: totalStats.vit,
      LUK: totalStats.luk,
    });
    const maxHp = derivedStats.maxHp;

    // Check if HP is already full
    if (userStats.currentHp >= maxHp) {
      throw new BadRequestException(
        'HP đã đầy, không cần sử dụng bình hồi máu',
      );
    }

    // Use HP from consumableValue first, then fallback to item stats (core attributes)
    const healAmount =
      userItem.item.consumableValue ||
      (userItem.item.stats?.vitality || 0) * 5 ||
      50; // Default 50 HP if not specified
    const oldHp = userStats.currentHp;
    const newHp = Math.min(maxHp, userStats.currentHp + healAmount);

    await this.userStatsService.update(userStats.id, {
      currentHp: newHp,
    });

    return {
      success: true,
      message: `Đã hồi ${newHp - oldHp} HP`,
      effects: {
        healAmount: newHp - oldHp,
        newHp: newHp,
        maxHp: maxHp,
      },
    };
  }

  private useMpPotion(
    userItem: UserItem,
    user: User,
  ): Promise<{ success: boolean; message: string; effects: any }> {
    // Treat MP potion as Stamina/Energy potion for now. Restore stamina by
    // consumableValue if present, otherwise default to 10.
    const amount = userItem.item.consumableValue || 10;
    return this.userStaminaService
      .restoreStamina(user.id, amount)
      .then((stamina) => {
        return {
          success: true,
          message: `Đã hồi ${amount} năng lượng`,
          effects: {
            staminaRestored: amount,
            currentStamina: stamina.currentStamina,
            maxStamina: stamina.maxStamina,
          },
        };
      })
      .catch((err) => {
        console.warn('Failed to restore stamina via MP potion:', err);
        return {
          success: false,
          message: 'Không thể sử dụng bình năng lượng lúc này',
          effects: { error: String(err) },
        };
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

    // Apply core attribute boosts from the item
    const boosts = {
      strength: Number(itemStats['strength']) || 0,
      intelligence: Number(itemStats['intelligence']) || 0,
      dexterity: Number(itemStats['dexterity']) || 0,
      vitality: Number(itemStats['vitality']) || 0,
      luck: Number(itemStats['luck']) || 0,
    };

    // Update user stats with boosts
    const updatedStats: Record<string, number> = {};
    Object.entries(boosts).forEach(([stat, value]) => {
      if (value > 0) {
        userStats[stat] += value;
        updatedStats[stat] = userStats[stat] as number;
        statBoosts[stat] = value;
      }
    });

    if (Object.keys(updatedStats).length > 0) {
      await this.userStatsService.update(userStats.id, updatedStats);
    }

    // Update user power based on new stats
    try {
      const equippedForPower = await this.getEquippedItems(user.id);
      const power = computeCombatPowerFromStats(
        userStats,
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

  private getEquivalentClassTypes(userType: string): string[] {
    const equivalents: Record<string, string[]> = {
      knight: ['knight', 'tank'],
      priest: ['priest', 'healer'],
      tank: ['tank', 'knight'],
      healer: ['healer', 'priest'],
    };
    return equivalents[userType] || [userType];
  }
}
