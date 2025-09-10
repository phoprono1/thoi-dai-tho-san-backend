import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

export enum ClassTier {
  C = 'C',
  B = 'B',
  A = 'A',
  S = 'S',
}

export enum ClassCategory {
  WARRIOR = 'warrior',
  MAGE = 'mage',
  ROGUE = 'rogue',
}

@Entity('classes')
export class Class {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: ClassTier,
    default: ClassTier.C,
  })
  tier: ClassTier;

  @Column({
    type: 'enum',
    enum: ClassCategory,
  })
  category: ClassCategory;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb' })
  baseStats: {
    atk?: number; // Attack percentage bonus
    def?: number; // Defense percentage bonus
    hp?: number; // HP percentage bonus
    critRate?: number; // Critical rate bonus
    critDamage?: number; // Critical damage bonus
    lifesteal?: number; // Lifesteal percentage
    penetration?: number; // Armor penetration percentage
  };

  @Column({ type: 'jsonb', nullable: true })
  requirements: {
    level?: number;
    items?: string[];
    quests?: string[];
  };

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
