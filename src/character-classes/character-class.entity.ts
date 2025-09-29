import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum ClassType {
  WARRIOR = 'warrior',
  MAGE = 'mage',
  ARCHER = 'archer',
  ASSASSIN = 'assassin',
  PRIEST = 'priest',
  KNIGHT = 'knight', // Tank specialization
  TANK = 'tank', // Alternative tank class
  HEALER = 'healer', // Healer specialization
  SUMMONER = 'summoner',
  NECROMANCER = 'necromancer',
}

export enum ClassTier {
  BASIC = 1, // Bậc 1 (lv 1-9) - Chưa thức tỉnh
  AWAKENED = 2, // Bậc 2 (lv 10-24) - Thức tỉnh lần 1
  ADVANCED = 3, // Bậc 3 (lv 25-49) - Chuyển chức lần 1
  EXPERT = 4, // Bậc 4 (lv 50-74) - Chuyển chức lần 2
  MASTER = 5, // Bậc 5 (lv 75-99) - Chuyển chức lần 3
  GRANDMASTER = 6, // Bậc 6 (lv 100-124) - Chuyển chức lần 4
  LEGENDARY = 7, // Bậc 7 (lv 125-149) - Chuyển chức lần 5
  MYTHIC = 8, // Bậc 8 (lv 150-174) - Chuyển chức lần 6
  TRANSCENDENT = 9, // Bậc 9 (lv 175-199) - Chuyển chức lần 7
  GODLIKE = 10, // Bậc 10 (lv 200+) - Chuyển chức lần 8 (Đỉnh cao)
}

export enum AdvancementStatus {
  LOCKED = 'locked',
  AVAILABLE = 'available',
  COMPLETED = 'completed',
}

@Entity('character_classes')
export class CharacterClass {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: ClassType,
  })
  type: ClassType;

  @Column({
    type: 'enum',
    enum: ClassTier,
  })
  tier: ClassTier;

  @Column({ type: 'integer', default: 1 })
  requiredLevel: number;

  @Column({ type: 'jsonb' })
  statBonuses: {
    // 5 Core stats only (converted to combat stats during battle)
    strength?: number;
    intelligence?: number;
    dexterity?: number;
    vitality?: number;
    luck?: number;
  };

  @Column({ type: 'jsonb' })
  skillUnlocks: Array<{
    skillId: number;
    skillName: string;
    description: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  advancementRequirements: {
    // Existing requirements
    dungeons?: Array<{
      dungeonId: number;
      dungeonName: string;
      requiredCompletions: number;
    }>;
    quests?: Array<{
      questId: number;
      questName: string;
    }>;
    items?: Array<{
      itemId: number;
      itemName: string;
      quantity: number;
    }>;
    // Enhanced requirements for 10-tier system
    stats?: {
      minStrength?: number;
      minIntelligence?: number;
      minDexterity?: number;
      minVitality?: number;
      minLuck?: number;
      minTotalStats?: number;
    };
    achievements?: Array<{
      achievementId: number;
      achievementName?: string;
    }>;
    pvpRank?: {
      minRank?: number;
      minPoints?: number;
    };
    guildLevel?: number;
    playtime?: number; // minutes
    previousClasses?: Array<{
      classId: number;
      className?: string;
      minTier?: number;
    }>;
  };

  @Column({ type: 'integer', nullable: true })
  previousClassId: number;

  @ManyToOne(() => CharacterClass, { nullable: true })
  @JoinColumn({ name: 'previousClassId' })
  previousClass: CharacterClass;

  // Flexible metadata - admin can store any additional info here
  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    displayName?: string; // Custom display name
    description?: string; // Custom description
    playstyle?: string; // Admin-defined playstyle
    difficulty?: string; // Admin-defined difficulty
    tags?: Array<string>; // Admin-defined tags
    notes?: string; // Admin notes
    customData?: Record<string, any>; // Any additional data admin wants to store
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('character_advancements')
export class CharacterAdvancement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  userId: number;

  @Column({ type: 'integer' })
  currentClassId: number;

  @ManyToOne(() => CharacterClass)
  @JoinColumn({ name: 'currentClassId' })
  currentClass: CharacterClass;

  @Column({
    type: 'enum',
    enum: AdvancementStatus,
    default: AdvancementStatus.LOCKED,
  })
  advancementStatus: AdvancementStatus;

  @Column({ type: 'jsonb', nullable: true })
  completedRequirements: {
    dungeons: Array<{
      dungeonId: number;
      completions: number;
    }>;
    quests: Array<{
      questId: number;
      completedAt: Date;
    }>;
    items: Array<{
      itemId: number;
      quantity: number;
    }>;
  };

  @Column({ type: 'timestamp', nullable: true })
  advancementDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
