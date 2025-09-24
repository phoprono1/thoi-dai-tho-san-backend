import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Level {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  level: number;

  @Column()
  experienceRequired: number; // Kinh nghiệm cần để lên level này

  @Column({ nullable: true })
  name: string; // Tên level (optional)

  @Column('json', { nullable: true })
  rewards: {
    gold?: number;
    items?: { itemId: number; quantity: number }[];
  }; // Phần thưởng khi lên level

  // Core attribute bonuses for this level
  @Column({ default: 0 })
  strength: number;

  @Column({ default: 0 })
  intelligence: number;

  @Column({ default: 0 })
  dexterity: number;

  @Column({ default: 0 })
  vitality: number;

  @Column({ default: 0 })
  luck: number;

  // Free attribute points rewarded at this level
  @Column({ default: 5 })
  attributePointsReward: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
