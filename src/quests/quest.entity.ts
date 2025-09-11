import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

export enum QuestType {
  MAIN = 'main',
  SIDE = 'side',
  DAILY = 'daily',
  EVENT = 'event',
}

export enum QuestStatus {
  AVAILABLE = 'available',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('quests')
export class Quest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: QuestType,
    default: QuestType.SIDE,
  })
  type: QuestType;

  @Column({ default: 1 })
  requiredLevel: number;

  @Column('json')
  requirements: {
    killEnemies?: {
      enemyType: string;
      count: number;
    }[];
    collectItems?: {
      itemId: number;
      itemName: string;
      quantity: number;
    }[];
    completeDungeons?: {
      dungeonId: number;
      dungeonName: string;
      count: number;
    }[];
    reachLevel?: number;
    defeatBoss?: {
      bossId: number;
      bossName: string;
    };
  };

  @Column('json')
  rewards: {
    experience?: number;
    gold?: number;
    items?: {
      itemId: number;
      itemName: string;
      quantity: number;
    }[];
  };

  @Column('json', { nullable: true })
  dependencies: {
    prerequisiteQuests?: number[]; // Quest IDs that must be completed first
    requiredLevel?: number;
    requiredClassTier?: number;
  };

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date; // For event quests

  @Column({ default: false })
  isRepeatable: boolean; // For daily quests

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('user_quests')
@Index(['userId', 'status'])
export class UserQuest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  questId: number;

  @ManyToOne(() => Quest)
  @JoinColumn({ name: 'questId' })
  quest: Quest;

  @Column({
    type: 'enum',
    enum: QuestStatus,
    default: QuestStatus.AVAILABLE,
  })
  @Index()
  status: QuestStatus;

  @Column('json', { nullable: true })
  progress: {
    killEnemies?: {
      enemyType: string;
      current: number;
      required: number;
    }[];
    collectItems?: {
      itemId: number;
      current: number;
      required: number;
    }[];
    completeDungeons?: {
      dungeonId: number;
      current: number;
      required: number;
    }[];
    currentLevel?: number;
    defeatedBoss?: boolean;
  };

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  startedAt: Date;

  @Column({ type: 'date', nullable: true })
  lastResetDate: Date; // For daily quests

  @Column({ default: 0 })
  completionCount: number; // Track how many times completed (for repeatable quests)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('quest_combat_tracking')
export class QuestCombatTracking {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  questId: number;

  @Column()
  combatResultId: number;

  @Column({ type: 'timestamp' })
  combatCompletedAt: Date;

  @Column({ default: false })
  questProgressUpdated: boolean; // Flag to prevent double processing

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
