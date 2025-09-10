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
import { WorldBoss } from './world-boss.entity';

export enum CombatAction {
  ATTACK = 'attack',
  DEFEND = 'defend',
  CRIT = 'crit',
  MISS = 'miss',
}

@Entity('boss_combat_log')
export class BossCombatLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  @Index()
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'integer' })
  @Index()
  bossId: number;

  @ManyToOne(() => WorldBoss)
  @JoinColumn({ name: 'bossId' })
  boss: WorldBoss;

  @Column({
    type: 'enum',
    enum: CombatAction,
  })
  action: CombatAction;

  @Column({ type: 'integer' })
  damage: number;

  @Column({ type: 'integer' })
  bossHpBefore: number;

  @Column({ type: 'integer' })
  bossHpAfter: number;

  @Column({ type: 'jsonb' })
  playerStats: {
    attack: number;
    defense: number;
    critRate: number;
    critDamage: number;
    currentHp: number;
    maxHp: number;
  };

  @Column({ type: 'jsonb' })
  bossStats: {
    attack: number;
    defense: number;
    currentHp: number;
    maxHp: number;
  };

  @Column({ type: 'integer', default: 0 })
  actionOrder: number;

  @Column({ type: 'integer', default: 1 })
  turn: number;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
