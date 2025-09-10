import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum MailType {
  SYSTEM = 'system',
  REWARD = 'reward',
  GIFTCODE = 'giftcode',
  GUILD = 'guild',
}

export enum MailStatus {
  UNREAD = 'unread',
  READ = 'read',
  CLAIMED = 'claimed',
}

@Entity('mailbox')
export class Mailbox {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  @Index()
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: MailType,
    default: MailType.SYSTEM,
  })
  @Index()
  type: MailType;

  @Column({
    type: 'enum',
    enum: MailStatus,
    default: MailStatus.UNREAD,
  })
  @Index()
  status: MailStatus;

  @Column({ type: 'jsonb', nullable: true })
  rewards: {
    gold?: number;
    experience?: number;
    items?: Array<{
      itemId: number;
      quantity: number;
    }>;
  };

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
