import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('daily_login_config')
export class DailyLoginConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'jsonb' })
  metadata: {
    dailyRewards: {
      day: number;
      rewards: {
        gold?: number;
        items?: { itemId: number; quantity: number }[];
        exp?: number;
      };
    }[];
    streakRewards: {
      streak: number;
      rewards: {
        gold?: number;
        items?: { itemId: number; quantity: number }[];
        exp?: number;
      };
    }[];
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
