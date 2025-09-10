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

  // Base stats for this level
  @Column({ default: 100 })
  maxHp: number;

  @Column({ default: 50 })
  maxMp: number;

  @Column({ default: 10 })
  attack: number;

  @Column({ default: 5 })
  defense: number;

  @Column({ default: 8 })
  speed: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
