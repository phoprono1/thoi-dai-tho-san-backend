import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum DonorStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
}

export enum DonorTier {
  BRONZE = 'bronze', // 1-10$
  SILVER = 'silver', // 11-50$
  GOLD = 'gold', // 51-100$
  PLATINUM = 'platinum', // 101-500$
  DIAMOND = 'diamond', // 500$+
}

@Entity('donors')
export class Donor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 100 })
  username: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: DonorTier,
  })
  tier: DonorTier;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'timestamp' })
  donationDate: Date;

  @Column({
    type: 'enum',
    enum: DonorStatus,
    default: DonorStatus.ACTIVE,
  })
  status: DonorStatus;

  @Column({ type: 'boolean', default: false })
  isAnonymous: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    paymentMethod?: string;
    transactionId?: string;
    platform?: string;
    campaignId?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
