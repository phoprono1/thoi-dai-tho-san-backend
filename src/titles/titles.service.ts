import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Title, TitleSource, TitleRarity } from './title.entity';
import { UserTitle } from './user-title.entity';
import { UserItemsService } from '../user-items/user-items.service';
import {
  CombatResult,
  CombatResultType,
} from '../combat-results/combat-result.entity';
import { User } from '../users/user.entity';

@Injectable()
export class TitlesService {
  constructor(
    @InjectRepository(Title)
    private titleRepository: Repository<Title>,
    @InjectRepository(UserTitle)
    private userTitleRepository: Repository<UserTitle>,
    @InjectRepository(CombatResult)
    private combatResultRepository: Repository<CombatResult>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => UserItemsService))
    private userItemsService: UserItemsService,
  ) {}

  // Get all available titles
  async getAllTitles(includeHidden = false): Promise<Title[]> {
    const where: any = { isActive: true };
    if (!includeHidden) {
      where.isHidden = false;
    }

    return this.titleRepository.find({
      where,
      order: { rarity: 'ASC', name: 'ASC' },
    });
  }

  // Get user's unlocked titles
  async getUserTitles(userId: number): Promise<UserTitle[]> {
    return this.userTitleRepository.find({
      where: { userId },
      relations: ['title'],
      order: { unlockedAt: 'DESC' },
    });
  }

  // Get user's equipped title
  async getEquippedTitle(userId: number): Promise<UserTitle | null> {
    return this.userTitleRepository.findOne({
      where: { userId, isEquipped: true },
      relations: ['title'],
    });
  }

  // Unlock title for user
  async unlockTitle(
    userId: number,
    titleId: number,
    source?: string,
  ): Promise<UserTitle> {
    // Check if user already has this title
    const existing = await this.userTitleRepository.findOne({
      where: { userId, titleId },
    });

    if (existing) {
      throw new BadRequestException('User already has this title');
    }

    // Check if title exists
    const title = await this.titleRepository.findOne({
      where: { id: titleId, isActive: true },
    });

    if (!title) {
      throw new NotFoundException('Title not found');
    }

    // Create user title
    const userTitle = this.userTitleRepository.create({
      userId,
      titleId,
      unlockedAt: new Date(),
      unlockSource: source || 'Manual unlock',
    });

    return this.userTitleRepository.save(userTitle);
  }

  // Equip title (unequip others first)
  async equipTitle(userId: number, titleId: number): Promise<UserTitle> {
    // Check if user has this title
    const userTitle = await this.userTitleRepository.findOne({
      where: { userId, titleId },
      relations: ['title'],
    });

    if (!userTitle) {
      throw new NotFoundException('User does not have this title');
    }

    // Unequip all other titles
    await this.userTitleRepository.update(
      { userId, isEquipped: true },
      { isEquipped: false },
    );

    // Equip this title
    userTitle.isEquipped = true;
    return this.userTitleRepository.save(userTitle);
  }

  // Unequip title
  async unequipTitle(userId: number): Promise<void> {
    await this.userTitleRepository.update(
      { userId, isEquipped: true },
      { isEquipped: false },
    );
  }

  // Admin: Create title
  async createTitle(titleData: Partial<Title>): Promise<Title> {
    const title = this.titleRepository.create(titleData);
    return this.titleRepository.save(title);
  }

  // Admin: Update title
  async updateTitle(
    titleId: number,
    titleData: Partial<Title>,
  ): Promise<Title> {
    const title = await this.titleRepository.findOne({
      where: { id: titleId },
    });
    if (!title) {
      throw new NotFoundException('Title not found');
    }

    Object.assign(title, titleData);
    return this.titleRepository.save(title);
  }

  // Admin: Delete title
  async deleteTitle(titleId: number): Promise<void> {
    const result = await this.titleRepository.delete(titleId);
    if (result.affected === 0) {
      throw new NotFoundException('Title not found');
    }
  }

  // Get title stats for user (for stats calculation)
  async getTitleStats(userId: number): Promise<any> {
    const equippedTitle = await this.getEquippedTitle(userId);
    return equippedTitle?.title?.stats || {};
  }

  // Check if user meets title requirements
  async checkTitleRequirements(
    userId: number,
    titleId: number,
  ): Promise<{
    eligible: boolean;
    missingRequirements: string[];
  }> {
    const title = await this.titleRepository.findOne({
      where: { id: titleId },
    });
    if (!title || !title.requirements) {
      return {
        eligible: false,
        missingRequirements: ['Title not found or no requirements'],
      };
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['guild'],
    });
    if (!user) {
      return { eligible: false, missingRequirements: ['User not found'] };
    }

    const requirements = title.requirements;
    const missing: string[] = [];

    // Check level requirement
    if (requirements.level && user.level < requirements.level) {
      missing.push(
        `Level ${requirements.level} required (current: ${user.level})`,
      );
    }

    // Check PvP rank requirement
    if (requirements.pvpRank) {
      // TODO: Get user's current PvP rank
      // For now, skip this check
    }

    if (
      requirements.guildLevel &&
      (!user.guild || user.guild.level < requirements.guildLevel)
    ) {
      missing.push(`Guild level ${requirements.guildLevel} required`);
    }

    // Check combat requirements
    if (
      requirements.killEnemies ||
      requirements.completeDungeons ||
      requirements.defeatBoss
    ) {
      const combatStats = await this.getCombatStats(userId);

      // Check enemy kill requirements
      if (requirements.killEnemies) {
        for (const enemyReq of requirements.killEnemies) {
          const userKills = combatStats.enemyKills[enemyReq.enemyType] || 0;
          if (userKills < enemyReq.count) {
            missing.push(
              `${enemyReq.count} ${enemyReq.enemyType} kills required (current: ${userKills})`,
            );
          }
        }
      }

      // Check dungeon completion requirements
      if (requirements.completeDungeons) {
        for (const dungeonReq of requirements.completeDungeons) {
          const userClears =
            combatStats.dungeonClearsByDungeon[dungeonReq.dungeonId] || 0;
          if (userClears < dungeonReq.count) {
            const dungeonName =
              dungeonReq.dungeonName || `Dungeon ${dungeonReq.dungeonId}`;
            missing.push(
              `${dungeonReq.count} clears of ${dungeonName} required (current: ${userClears})`,
            );
          }
        }
      }

      // Check boss defeat requirements
      if (requirements.defeatBoss) {
        for (const bossReq of requirements.defeatBoss) {
          const userDefeats = combatStats.bossDefeats[bossReq.bossId] || 0;
          const requiredCount = bossReq.count || 1;
          if (userDefeats < requiredCount) {
            const bossName = bossReq.bossName || `Boss ${bossReq.bossId}`;
            missing.push(
              `Defeat ${bossName} ${requiredCount} times (current: ${userDefeats})`,
            );
          }
        }
      }
    }

    // Check item requirements
    if (requirements.itemsRequired) {
      const userItems = await this.userItemsService.findByUserId(userId);
      const itemCounts: Record<number, number> = {};

      for (const userItem of userItems) {
        itemCounts[userItem.itemId] =
          (itemCounts[userItem.itemId] || 0) + userItem.quantity;
      }

      for (const itemReq of requirements.itemsRequired) {
        const userCount = itemCounts[itemReq.itemId] || 0;
        if (userCount < itemReq.quantity) {
          missing.push(
            `${itemReq.quantity} of item ${itemReq.itemId} required (current: ${userCount})`,
          );
        }
      }
    }

    return {
      eligible: missing.length === 0,
      missingRequirements: missing,
    };
  }

  // Get detailed combat statistics for user (similar to Quest system)
  private async getCombatStats(userId: number): Promise<{
    dungeonClears: number;
    dungeonClearsByDungeon: Record<number, number>;
    enemyKills: Record<string, number>; // enemyType -> count
    bossDefeats: Record<number, number>; // bossId -> count
  }> {
    // Find combat results where user participated
    const combatResults = await this.combatResultRepository
      .createQueryBuilder('combatResult')
      .leftJoinAndSelect('combatResult.dungeon', 'dungeon')
      .leftJoinAndSelect('combatResult.logs', 'logs')
      .where(':userId = ANY(combatResult.userIds)', { userId })
      .getMany();

    let dungeonClears = 0;
    const dungeonClearsByDungeon: Record<number, number> = {};
    const enemyKills: Record<string, number> = {};
    const bossDefeats: Record<number, number> = {};

    for (const result of combatResults) {
      // Count dungeon clears (only victories)
      if (result.dungeon && result.result === CombatResultType.VICTORY) {
        dungeonClears++;
        const dungeonId = result.dungeon.id;
        dungeonClearsByDungeon[dungeonId] =
          (dungeonClearsByDungeon[dungeonId] || 0) + 1;
      }

      // Parse combat logs for detailed enemy kills and boss defeats
      if (result.logs && result.logs.length > 0) {
        for (const log of result.logs) {
          try {
            // Combat logs should contain enemy kill data
            if (log.action === 'enemy_defeated' && log.data) {
              const enemyType =
                log.data.enemyType || log.data.monsterType || 'unknown';
              enemyKills[enemyType] = (enemyKills[enemyType] || 0) + 1;
            }

            // Boss defeat tracking
            if (log.action === 'boss_defeated' && log.data) {
              const bossId = log.data.bossId || log.data.monsterId;
              if (bossId) {
                bossDefeats[bossId] = (bossDefeats[bossId] || 0) + 1;
              }
            }
          } catch (error) {
            // Skip invalid log entries
            continue;
          }
        }
      }
    }

    return {
      dungeonClears,
      dungeonClearsByDungeon,
      enemyKills,
      bossDefeats,
    };
  }

  // Auto-check and unlock eligible titles for user
  async checkAndUnlockEligibleTitles(userId: number): Promise<UserTitle[]> {
    const allTitles = await this.getAllTitles();
    const userTitles = await this.getUserTitles(userId);
    const unlockedTitleIds = new Set(userTitles.map((ut) => ut.titleId));

    const newlyUnlocked: UserTitle[] = [];

    for (const title of allTitles) {
      // Skip if user already has this title
      if (unlockedTitleIds.has(title.id)) continue;

      // Check requirements
      const { eligible } = await this.checkTitleRequirements(userId, title.id);

      if (eligible) {
        try {
          const userTitle = await this.unlockTitle(
            userId,
            title.id,
            'Auto-unlock: Requirements met',
          );
          newlyUnlocked.push(userTitle);
        } catch (error) {
          console.warn(
            `Failed to auto-unlock title ${title.id} for user ${userId}:`,
            error,
          );
        }
      }
    }

    return newlyUnlocked;
  }

  // Initialize default titles
  async initializeDefaultTitles(): Promise<void> {
    const defaultTitles = [
      {
        name: 'Tân Thủ',
        description: 'Danh hiệu cho người mới bắt đầu',
        rarity: TitleRarity.COMMON,
        source: TitleSource.ACHIEVEMENT,
        stats: {
          strength: 1,
          intelligence: 1,
          dexterity: 1,
          vitality: 1,
          luck: 1,
        },
        displayEffects: {
          color: '#8B5A2B',
          prefix: '[Tân Thủ]',
        },
        requirements: { level: 1 },
      },
      {
        name: 'Thợ Săn Tập Sự',
        description: 'Danh hiệu PvP cơ bản',
        rarity: TitleRarity.COMMON,
        source: TitleSource.PVP_RANK,
        stats: { strength: 5, dexterity: 5 },
        displayEffects: {
          color: '#4A5568',
          prefix: '[Tập Sự]',
        },
        requirements: { pvpRank: 'APPRENTICE' },
      },
      {
        name: 'Huyền Thoại',
        description: 'Danh hiệu cho những thợ săn huyền thoại',
        rarity: TitleRarity.LEGENDARY,
        source: TitleSource.PVP_RANK,
        stats: {
          strength: 50,
          intelligence: 50,
          dexterity: 50,
          vitality: 50,
          luck: 50,
        },
        displayEffects: {
          color: '#FFD700',
          backgroundColor: '#FF6B35',
          glow: true,
          animation: 'pulse',
          prefix: '[Huyền Thoại]',
        },
        requirements: { pvpRank: 'LEGENDARY' },
      },
      {
        name: 'Sát Thủ Goblin',
        description: 'Chuyên gia diệt Goblin',
        rarity: TitleRarity.UNCOMMON,
        source: TitleSource.ACHIEVEMENT,
        stats: { strength: 10, dexterity: 10 },
        displayEffects: {
          color: '#DC2626',
          prefix: '[Sát Thủ]',
          animation: 'pulse',
        },
        requirements: {
          killEnemies: [{ enemyType: 'Goblin', count: 100 }],
          description: 'Tiêu diệt 100 Goblin',
        },
      },
      {
        name: 'Chinh Phục Hầm Ngục',
        description: 'Đã hoàn thành nhiều hầm ngục',
        rarity: TitleRarity.RARE,
        source: TitleSource.ACHIEVEMENT,
        stats: { strength: 15, intelligence: 15, vitality: 15 },
        displayEffects: {
          color: '#7C3AED',
          prefix: '[Chinh Phục]',
          animation: 'glow',
        },
        requirements: {
          completeDungeons: [
            { dungeonId: 1, dungeonName: 'Goblin Cave', count: 50 },
            { dungeonId: 2, dungeonName: 'Dark Forest', count: 30 },
          ],
          description: 'Hoàn thành Goblin Cave 50 lần và Dark Forest 30 lần',
        },
      },
      {
        name: 'Thu Thập Gia',
        description: 'Sở hữu nhiều vật phẩm quý hiếm',
        rarity: TitleRarity.UNCOMMON,
        source: TitleSource.ACHIEVEMENT,
        stats: { luck: 20, intelligence: 10 },
        displayEffects: {
          color: '#059669',
          prefix: '[Thu Thập]',
        },
        requirements: {
          itemsRequired: [
            { itemId: 1, quantity: 100 }, // Ví dụ: 100 HP Potion
            { itemId: 2, quantity: 50 }, // Ví dụ: 50 Energy Potion
          ],
          description: 'Sở hữu 100 HP Potion và 50 Energy Potion',
        },
      },
      {
        name: 'Kẻ Hủy Diệt Boss',
        description: 'Chuyên gia tiêu diệt Boss',
        rarity: TitleRarity.EPIC,
        source: TitleSource.ACHIEVEMENT,
        stats: { strength: 25, intelligence: 25, dexterity: 25, vitality: 25 },
        displayEffects: {
          color: '#F59E0B',
          glow: true,
          prefix: '[Hủy Diệt]',
          animation: 'rainbow',
        },
        requirements: {
          defeatBoss: [
            { bossId: 1, bossName: 'Goblin King', count: 10 },
            { bossId: 2, bossName: 'Dark Lord', count: 5 },
          ],
          description: 'Tiêu diệt Goblin King 10 lần và Dark Lord 5 lần',
        },
      },
    ];

    for (const titleData of defaultTitles) {
      const existing = await this.titleRepository.findOne({
        where: { name: titleData.name },
      });

      if (!existing) {
        await this.createTitle(titleData);
      }
    }
  }

  // Send title to user by username
  async sendTitleToUser(
    titleId: number,
    username: string,
    reason?: string,
  ): Promise<UserTitle> {
    // Find user by username
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException(
        `User với username "${username}" không tồn tại`,
      );
    }

    // Find title
    const title = await this.titleRepository.findOne({
      where: { id: titleId },
    });

    if (!title) {
      throw new NotFoundException(`Title với ID ${titleId} không tồn tại`);
    }

    // Check if user already has this title
    const existingUserTitle = await this.userTitleRepository.findOne({
      where: { userId: user.id, titleId },
    });

    if (existingUserTitle) {
      throw new BadRequestException(
        `User "${username}" đã có danh hiệu "${title.name}"`,
      );
    }

    // Create user title
    const userTitle = this.userTitleRepository.create({
      userId: user.id,
      titleId,
      unlockSource: reason || 'Admin grant',
      unlockedAt: new Date(),
    });

    const savedUserTitle = await this.userTitleRepository.save(userTitle);

    // Return with relations
    return this.userTitleRepository.findOne({
      where: { id: savedUserTitle.id },
      relations: ['title', 'user'],
    });
  }
}
