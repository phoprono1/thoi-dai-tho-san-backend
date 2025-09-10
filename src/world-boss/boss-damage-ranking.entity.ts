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

export enum RankingType {
  INDIVIDUAL = 'individual',
  GUILD = 'guild',
}

@Entity('boss_damage_ranking')
@Unique(['bossId', 'userId', 'rankingType'])
export class BossDamageRanking {
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

  @Column({ type: 'integer', nullable: true })
  @Index()
  guildId: number;

  @Column({
    type: 'enum',
    enum: RankingType,
    default: RankingType.INDIVIDUAL,
  })
  @Index()
  rankingType: RankingType;

  @Column({ type: 'bigint', default: 0 })
  totalDamage: number;

  @Column({ type: 'integer', default: 0 })
  attackCount: number;

  @Column({ type: 'integer', default: 0 })
  rank: number;

  @Column({ type: 'bigint', default: 0 })
  lastDamage: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
