import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStat } from './user-stat.entity';
import { UserPowerService } from '../user-power/user-power.service';
import { LevelsService } from '../levels/levels.service';
import { UserItemsService } from '../user-items/user-items.service';
import { GuildBuffService } from '../guild/guild-buff.service';
import { GlobalGuildBuffService } from '../guild/global-guild-buff.service';
import { SetBonusType } from '../items/item-set.entity';
import { User } from '../users/user.entity';
import { TitlesService } from '../titles/titles.service';
import { ItemSetsService } from '../items/item-sets.service';
@Injectable()
export class UserStatsService {
  constructor(
    @InjectRepository(UserStat)
    private userStatsRepository: Repository<UserStat>,
    private readonly userPowerService: UserPowerService,
    private readonly levelsService: LevelsService,
    @Inject(forwardRef(() => UserItemsService))
    private readonly userItemsService: UserItemsService,
    private readonly itemSetsService: ItemSetsService,
    @Inject(forwardRef(() => GlobalGuildBuffService))
    private readonly globalGuildBuffService: GlobalGuildBuffService,
    @Inject(forwardRef(() => TitlesService))
    private readonly titlesService: TitlesService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  // Simple CRUD for core attributes only
  async findAll(): Promise<UserStat[]> {
    return this.userStatsRepository.find({ relations: ['user'] });
  }

  async findOne(id: number): Promise<UserStat | null> {
    return this.userStatsRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  async findByUserId(userId: number): Promise<UserStat | null> {
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
      // best-effort
    }
    return saved;
  }

  async update(
    id: number,
    userStat: Partial<UserStat>,
  ): Promise<UserStat | null> {
    await this.userStatsRepository.update(id, userStat);
    const updated = await this.findOne(id);
    // Update power after core stat changes
    try {
      if (updated && updated.userId) {
        await this.userPowerService.computeAndSaveForUser(updated.userId);
      }
    } catch {
      // best-effort
    }
    return updated;
  }

  async updateByUserId(
    userId: number,
    updates: Partial<UserStat>,
  ): Promise<UserStat | null> {
    const userStats = await this.findByUserId(userId);
    if (!userStats) return null;

    await this.userStatsRepository.update(userStats.id, updates);
    const updated = await this.findByUserId(userId);

    // Update power after core stat changes
    try {
      await this.userPowerService.computeAndSaveForUser(userId);
    } catch {
      // best-effort
    }

    return updated;
  }

  async remove(id: number): Promise<void> {
    await this.userStatsRepository.delete(id);
  }

  // Initialize stats for new user
  async createForUser(userId: number): Promise<UserStat> {
    const userStat = this.userStatsRepository.create({
      userId,
      currentHp: 100,
      strength: 10,
      intelligence: 10,
      dexterity: 10,
      vitality: 10,
      luck: 10,
      unspentAttributePoints: 0, // Start with 0 points
      strengthPoints: 0,
      intelligencePoints: 0,
      dexterityPoints: 0,
      vitalityPoints: 0,
      luckPoints: 0,
    });

    const saved = await this.userStatsRepository.save(userStat);

    // Compute initial power
    try {
      await this.userPowerService.computeAndSaveForUser(userId);
    } catch {
      // best-effort
    }

    return saved;
  }

  // ===== FREE ATTRIBUTE POINTS SYSTEM =====

  /**
   * Allocate one attribute point to a specific attribute
   */
  async allocateAttributePoint(
    userId: number,
    attribute: 'STR' | 'INT' | 'DEX' | 'VIT' | 'LUK',
  ): Promise<{ success: boolean; message: string }> {
    const userStats = await this.findByUserId(userId);
    if (!userStats) {
      return { success: false, message: 'User stats not found' };
    }

    if (userStats.unspentAttributePoints <= 0) {
      return {
        success: false,
        message: 'No unspent attribute points available',
      };
    }

    // Decrease unspent points
    userStats.unspentAttributePoints--;

    // Increase the specific attribute points
    switch (attribute) {
      case 'STR':
        userStats.strengthPoints++;
        break;
      case 'INT':
        userStats.intelligencePoints++;
        break;
      case 'DEX':
        userStats.dexterityPoints++;
        break;
      case 'VIT':
        userStats.vitalityPoints++;
        break;
      case 'LUK':
        userStats.luckPoints++;
        break;
    }

    await this.userStatsRepository.save(userStats);

    // Update user power after attribute allocation
    try {
      await this.userPowerService.computeAndSaveForUser(userId);
    } catch {
      // best-effort
    }

    return {
      success: true,
      message: `Successfully allocated 1 point to ${attribute}`,
    };
  }

  /**
   * Allocate multiple attribute points at once
   */
  async allocateMultipleAttributePoints(
    userId: number,
    allocations: Record<'STR' | 'INT' | 'DEX' | 'VIT' | 'LUK', number>,
  ): Promise<{ success: boolean; message: string }> {
    const userStats = await this.findByUserId(userId);
    if (!userStats) {
      return { success: false, message: 'User stats not found' };
    }

    // Calculate total points to allocate
    const totalPointsToAllocate = Object.values(allocations).reduce(
      (sum, points) => sum + points,
      0,
    );

    if (totalPointsToAllocate <= 0) {
      return { success: false, message: 'No points to allocate' };
    }

    if (userStats.unspentAttributePoints < totalPointsToAllocate) {
      return {
        success: false,
        message: `Not enough unspent attribute points. Available: ${userStats.unspentAttributePoints}, Required: ${totalPointsToAllocate}`,
      };
    }

    // Validate no negative allocations
    for (const [attr, points] of Object.entries(allocations)) {
      if (points < 0) {
        return {
          success: false,
          message: `Cannot allocate negative points to ${attr}`,
        };
      }
    }

    // Decrease unspent points
    userStats.unspentAttributePoints -= totalPointsToAllocate;

    // Increase the specific attribute points
    for (const [attr, points] of Object.entries(allocations)) {
      switch (attr) {
        case 'STR':
          userStats.strengthPoints += points;
          break;
        case 'INT':
          userStats.intelligencePoints += points;
          break;
        case 'DEX':
          userStats.dexterityPoints += points;
          break;
        case 'VIT':
          userStats.vitalityPoints += points;
          break;
        case 'LUK':
          userStats.luckPoints += points;
          break;
      }
    }

    await this.userStatsRepository.save(userStats);

    // Update user power after attribute allocation
    try {
      await this.userPowerService.computeAndSaveForUser(userId);
    } catch {
      // best-effort
    }

    return {
      success: true,
      message: `Successfully allocated ${totalPointsToAllocate} attribute points`,
    };
  }

  /**
   * Add free attribute points to user (called on level up)
   */
  async addFreeAttributePoints(userId: number, points: number): Promise<void> {
    const userStats = await this.findByUserId(userId);
    if (!userStats) return;

    userStats.unspentAttributePoints += points;
    await this.userStatsRepository.save(userStats);
  }

  /**
   * Reset all allocated attribute points (refund to unspent)
   */
  async resetAttributePoints(
    userId: number,
  ): Promise<{ success: boolean; message: string }> {
    const userStats = await this.findByUserId(userId);
    if (!userStats) {
      return { success: false, message: 'User stats not found' };
    }

    // Calculate total allocated points
    const totalAllocated =
      userStats.strengthPoints +
      userStats.intelligencePoints +
      userStats.dexterityPoints +
      userStats.vitalityPoints +
      userStats.luckPoints;

    if (totalAllocated === 0) {
      return { success: false, message: 'No allocated points to reset' };
    }

    // Refund points to unspent pool
    userStats.unspentAttributePoints += totalAllocated;

    // Reset all allocated points
    userStats.strengthPoints = 0;
    userStats.intelligencePoints = 0;
    userStats.dexterityPoints = 0;
    userStats.vitalityPoints = 0;
    userStats.luckPoints = 0;

    await this.userStatsRepository.save(userStats);

    // Update user power after reset
    try {
      await this.userPowerService.computeAndSaveForUser(userId);
    } catch {
      // best-effort
    }

    return {
      success: true,
      message: `Successfully reset ${totalAllocated} allocated points`,
    };
  }

  /**
   * Recalculate and update current HP based on current total stats
   * Useful after level up or stat changes
   */
  async updateHpToMax(userId: number): Promise<void> {
    try {
      const totalStats = await this.getTotalStatsWithAllBonuses(userId);
      const { deriveCombatStats } = await import(
        '../combat-engine/stat-converter'
      );
      const combatStats = deriveCombatStats({
        baseAttack: 10,
        baseMaxHp: 100,
        baseDefense: 5,
        STR: totalStats.str,
        INT: totalStats.int,
        DEX: totalStats.dex,
        VIT: totalStats.vit,
        LUK: totalStats.luk,
      });

      await this.updateByUserId(userId, {
        currentHp: combatStats.maxHp,
      });
    } catch (error) {
      console.warn(
        'Failed to update HP to max:',
        error instanceof Error ? error.message : error,
      );
    }
  }
  async getTotalStatsWithAllBonuses(userId: number): Promise<{
    str: number;
    int: number;
    dex: number;
    vit: number;
    luk: number;
  }> {
    const userStats = await this.findByUserId(userId);
    if (!userStats) {
      throw new Error(`User ${userId} not found`);
    }

    // Get user with character class
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['characterClass'],
    });
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // 1. Base stats + allocated points
    let totalStr = userStats.strength + userStats.strengthPoints;
    let totalInt = userStats.intelligence + userStats.intelligencePoints;
    let totalDex = userStats.dexterity + userStats.dexterityPoints;
    let totalVit = userStats.vitality + userStats.vitalityPoints;
    let totalLuk = userStats.luck + userStats.luckPoints;

    // 2. Level bonuses (permanent additive)
    try {
      const levelBonuses = await this.levelsService.getTotalLevelStats(
        user.level,
      );
      totalStr += levelBonuses.strength || 0;
      totalInt += levelBonuses.intelligence || 0;
      totalDex += levelBonuses.dexterity || 0;
      totalVit += levelBonuses.vitality || 0;
      totalLuk += levelBonuses.luck || 0;
    } catch (error) {
      console.warn('Failed to get level bonuses:', error);
    }

    // 3. Class bonuses (permanent additive)
    if (user.characterClass?.statBonuses) {
      const classBonuses = user.characterClass.statBonuses;
      totalStr += classBonuses.strength || 0;
      totalInt += classBonuses.intelligence || 0;
      totalDex += classBonuses.dexterity || 0;
      totalVit += classBonuses.vitality || 0;
      totalLuk += classBonuses.luck || 0;
    }

    // Note: Class history buffs will be implemented separately to avoid circular dependency

    // 4. Equipment bonuses (temporary when equipped)
    try {
      const equippedItems =
        await this.userItemsService.getEquippedItems(userId);

      for (const userItem of equippedItems) {
        if (userItem.item?.stats) {
          const itemStats = userItem.item.stats;
          totalStr += itemStats.strength || 0;
          totalInt += itemStats.intelligence || 0;
          totalDex += itemStats.dexterity || 0;
          totalVit += itemStats.vitality || 0;
          totalLuk += itemStats.luck || 0;
        }

        // Note: upgradeStats only contains combat stats, not core attributes
        // Core attribute bonuses come from the base item stats above
      }

      // 5. Set bonuses (temporary when equipped set pieces)
      try {
        // Group equipped items by setId
        const setCounts: Record<number, number> = {};
        for (const userItem of equippedItems) {
          if (userItem.item?.setId) {
            setCounts[userItem.item.setId] =
              (setCounts[userItem.item.setId] || 0) + 1;
          }
        }

        // Apply set bonuses for each set that has enough pieces
        for (const [setId, pieceCount] of Object.entries(setCounts)) {
          const setIdNum = parseInt(setId);
          if (isNaN(setIdNum)) continue;

          // Get item set with bonuses
          const itemSet = await this.itemSetsService.findOne(setIdNum);
          if (!itemSet?.setBonuses) continue;

          // Apply bonuses for each threshold met
          for (const bonus of itemSet.setBonuses) {
            if (pieceCount >= bonus.pieces) {
              // Only apply core stat bonuses (str, int, dex, vit, luk)
              const bonusStats = bonus.stats;
              if (bonus.type === SetBonusType.FLAT) {
                totalStr += bonusStats.strength || 0;
                totalInt += bonusStats.intelligence || 0;
                totalDex += bonusStats.dexterity || 0;
                totalVit += bonusStats.vitality || 0;
                totalLuk += bonusStats.luck || 0;
              } else if (bonus.type === SetBonusType.PERCENTAGE) {
                // For percentage bonuses, calculate based on current total stats (including all previous bonuses)
                // This creates better stacking effects
                totalStr += Math.floor(
                  totalStr * ((bonusStats.strength || 0) / 100),
                );
                totalInt += Math.floor(
                  totalInt * ((bonusStats.intelligence || 0) / 100),
                );
                totalDex += Math.floor(
                  totalDex * ((bonusStats.dexterity || 0) / 100),
                );
                totalVit += Math.floor(
                  totalVit * ((bonusStats.vitality || 0) / 100),
                );
                totalLuk += Math.floor(
                  totalLuk * ((bonusStats.luck || 0) / 100),
                );
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to apply set bonuses:', error);
      }
    } catch (error) {
      console.warn('Failed to get equipment bonuses:', error);
    }

    // 6. Guild buffs (only if user is in a guild)
    try {
      const guildBuffs =
        await this.globalGuildBuffService.getUserGuildBuffs(userId);
      if (guildBuffs) {
        totalStr += guildBuffs.strength || 0;
        totalInt += guildBuffs.intelligence || 0;
        totalDex += guildBuffs.dexterity || 0;
        totalVit += guildBuffs.vitality || 0;
        totalLuk += guildBuffs.luck || 0;
      }
    } catch (error) {
      console.warn('Failed to get guild buffs:', error);
    }

    // 7. Title bonuses (only if user has equipped title)
    try {
      const titleStats = await this.titlesService.getTitleStats(userId);
      if (titleStats) {
        totalStr += titleStats.strength || 0;
        totalInt += titleStats.intelligence || 0;
        totalDex += titleStats.dexterity || 0;
        totalVit += titleStats.vitality || 0;
        totalLuk += titleStats.luck || 0;
      }
    } catch (error) {
      console.warn('Failed to get title stats:', error);
    }

    return {
      str: totalStr,
      int: totalInt,
      dex: totalDex,
      vit: totalVit,
      luk: totalLuk,
    };
  }
}
