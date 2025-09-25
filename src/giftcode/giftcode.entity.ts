import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('giftcode')
export class GiftCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  @Index()
  code: string;

  // JSONB rewards payload compatible with Mailbox.rewards
  @Column({ type: 'jsonb', nullable: true })
  rewards: any;

  @Column({ type: 'integer', nullable: true })
  usesAllowed: number | null;

  @Column({ type: 'integer', nullable: true })
  usesRemaining: number | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
