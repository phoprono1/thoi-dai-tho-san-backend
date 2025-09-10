import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MonsterType {
  NORMAL = 'normal',
  ELITE = 'elite',
  BOSS = 'boss',
  MINI_BOSS = 'mini_boss',
}

export enum MonsterElement {
  FIRE = 'fire',
  WATER = 'water',
  EARTH = 'earth',
  WIND = 'wind',
  LIGHT = 'light',
  DARK = 'dark',
  NEUTRAL = 'neutral',
}

@Entity('monsters')
export class Monster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: MonsterType,
    default: MonsterType.NORMAL,
  })
  type: MonsterType;

  @Column({
    type: 'enum',
    enum: MonsterElement,
    default: MonsterElement.NEUTRAL,
  })
  element: MonsterElement;

  @Column({ default: 1 })
  level: number;

  @Column({ type: 'int', default: 100 })
  baseHp: number;

  @Column({ type: 'int', default: 10 })
  baseAttack: number;

  @Column({ type: 'int', default: 5 })
  baseDefense: number;

  @Column({ type: 'int', default: 50 })
  experienceReward: number;

  @Column({ type: 'int', default: 10 })
  goldReward: number;

  // Drop items
  @Column('json', { nullable: true })
  dropItems: {
    itemId: number;
    dropRate: number;
    minQuantity: number;
    maxQuantity: number;
  }[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
