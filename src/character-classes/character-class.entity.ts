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
  KNIGHT = 'knight',
  TANK = 'tank',
  HEALER = 'healer',
  SUMMONER = 'summoner',
  NECROMANCER = 'necromancer',
}

export enum ClassTier {
  BASIC = 1, // Bậc 1 (lv 1-9) - Chưa thức tỉnh
  ADVANCED = 2, // Bậc 2 (lv 10-49) - Thức tỉnh lần 1
  MASTER = 3, // Bậc 3 (lv 50-99) - Thức tỉnh lần 2
  LEGENDARY = 4, // Bậc 4 (lv 100+) - Thức tỉnh lần 3
  GODLIKE = 5, // Bậc 5 (lv 150+) - Thức tỉnh lần 4 (dự kiến)
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
    // Basic stats
    strength?: number;
    intelligence?: number;
    dexterity?: number;
    vitality?: number;
    luck?: number;
    // Advanced stats
    critRate?: number; // Bạo kích (%)
    critDamage?: number; // Sát thương bạo kích (%)
    comboRate?: number; // Liên kích (%)
    counterRate?: number; // Phản kích (%)
    lifesteal?: number; // Hút máu (%)
    armorPen?: number; // Xuyên giáp (%)
    dodgeRate?: number; // Né tránh (%)
    accuracy?: number; // Chính xác (%)
  };

  @Column({ type: 'jsonb' })
  skillUnlocks: Array<{
    skillId: number;
    skillName: string;
    description: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  advancementRequirements: {
    dungeons: Array<{
      dungeonId: number;
      dungeonName: string;
      requiredCompletions: number;
    }>;
    quests: Array<{
      questId: number;
      questName: string;
    }>;
    items: Array<{
      itemId: number;
      itemName: string;
      quantity: number;
    }>;
  };

  @Column({ type: 'integer', nullable: true })
  previousClassId: number;

  @ManyToOne(() => CharacterClass, { nullable: true })
  @JoinColumn({ name: 'previousClassId' })
  previousClass: CharacterClass;

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
