import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Title } from './title.entity';

@Entity()
@Index(['userId', 'titleId'], { unique: true }) // User can only have each title once
export class UserTitle {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => Title)
  @JoinColumn()
  title: Title;

  @Column()
  titleId: number;

  @Column({ default: false })
  isEquipped: boolean; // Only one title can be equipped at a time

  @Column({ type: 'timestamp', nullable: true })
  unlockedAt: Date;

  @Column({ type: 'text', nullable: true })
  unlockSource: string; // How the user got this title

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
