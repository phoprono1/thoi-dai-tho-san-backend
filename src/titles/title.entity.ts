import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TitleRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

export enum TitleSource {
  ACHIEVEMENT = 'achievement', // Từ thành tựu
  PVP_RANK = 'pvp_rank', // Từ rank PvP
  GUILD_RANK = 'guild_rank', // Từ cấp bậc guild
  EVENT = 'event', // Từ sự kiện
  ADMIN = 'admin', // Admin tặng
}

@Entity()
export class Title {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TitleRarity,
    default: TitleRarity.COMMON,
  })
  rarity: TitleRarity;

  @Column({
    type: 'enum',
    enum: TitleSource,
    default: TitleSource.ACHIEVEMENT,
  })
  source: TitleSource;

  // Stats bonuses from title
  @Column('json', { nullable: true })
  stats: {
    strength?: number;
    intelligence?: number;
    dexterity?: number;
    vitality?: number;
    luck?: number;
  };

  // Visual effects for title display
  @Column('json', { nullable: true })
  displayEffects: {
    color?: string; // Text color (#hex)
    backgroundColor?: string; // Background color
    borderColor?: string; // Border color
    glow?: boolean; // Glow effect
    animation?: string; // Animation type (pulse, fade, etc.)
    prefix?: string; // Prefix before name "[Lord] PlayerName"
  };

  // Unlock requirements
  @Column('json', { nullable: true })
  requirements: {
    // Basic requirements
    level?: number;
    pvpRank?: string; // HunterRank enum values
    guildLevel?: number;
    achievementIds?: number[];

    // Combat requirements (detailed tracking like Quest system)
    killEnemies?: {
      enemyType: string; // Monster type or specific monster name
      count: number;
    }[];
    completeDungeons?: {
      dungeonId: number;
      dungeonName?: string; // For display
      count: number;
    }[];
    defeatBoss?: {
      bossId: number;
      bossName?: string; // For display
      count?: number; // How many times to defeat
    }[];

    // Collection requirements
    itemsRequired?: {
      itemId: number;
      itemName?: string; // For display
      quantity: number;
    }[];

    // PvP requirements
    pvpWins?: number;
    pvpPoints?: number; // Minimum hunter points
    pvpWinStreak?: number; // Consecutive wins

    // Guild requirements
    guildContribution?: number;
    guildRank?: string; // Guild member rank

    // Economic requirements
    goldSpent?: number;
    goldOwned?: number; // Current gold amount
    experienceGained?: number;

    // Time-based requirements
    playTimeDays?: number; // Days since account creation
    loginStreak?: number; // Consecutive login days

    // Meta requirements
    titlesUnlocked?: number; // Number of other titles unlocked

    description?: string;
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isHidden: boolean; // Hidden until unlocked

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
