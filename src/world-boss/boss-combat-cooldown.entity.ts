import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { WorldBoss } from './world-boss.entity';

@Entity('boss_combat_cooldown')
@Unique(['bossId', 'userId'])
export class BossCombatCooldown {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  @Index()
  bossId: number;

  @ManyToOne(() => WorldBoss)
  @JoinColumn({ name: 'bossId' })
  boss: WorldBoss;

  @Column({ type: 'integer' })
  @Index()
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'timestamp' })
  lastCombatTime: Date;

  @Column({ type: 'timestamp' })
  cooldownUntil: Date; // Thời gian có thể combat lại

  @Column({ type: 'integer', default: 60 })
  cooldownSeconds: number; // Thời gian cooldown (giây)

  @Column({ type: 'integer', default: 0 })
  totalCombats: number; // Tổng số lần đã combat

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
