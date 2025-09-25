import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('daily_login_records')
export class DailyLoginRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'date' })
  loginDate: Date;

  @Column({ type: 'int', default: 1 })
  streakCount: number;

  @Column({ type: 'boolean', default: false })
  claimed: boolean;

  @Column({ type: 'jsonb', nullable: true })
  rewards: {
    gold?: number;
    items?: { itemId: number; quantity: number }[];
    exp?: number;
  };

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
