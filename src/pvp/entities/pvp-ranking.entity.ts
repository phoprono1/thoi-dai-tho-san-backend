import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { PvpSeason, HunterRank, RANK_NAMES } from './pvp-season.entity';

@Entity('pvp_rankings')
export class PvpRanking {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => PvpSeason, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seasonId' })
  season: PvpSeason;

  @Column()
  seasonId: number;

  @Column({ type: 'int', default: 1200 })
  hunterPoints: number; // ELO rating

  @Column({
    type: 'enum',
    enum: HunterRank,
    default: HunterRank.APPRENTICE,
  })
  currentRank: HunterRank;

  @Column({ type: 'int', default: 0 })
  wins: number;

  @Column({ type: 'int', default: 0 })
  losses: number;

  @Column({ type: 'int', default: 0 })
  totalMatches: number;

  @Column({ type: 'int', default: 0 })
  winStreak: number;

  @Column({ type: 'int', default: 0 })
  bestWinStreak: number;

  @Column({ type: 'int', default: 1200 })
  highestPoints: number;

  @Column({ type: 'timestamp', nullable: true })
  lastMatchAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastOpponentRefreshAt: Date;

  @Column({ type: 'boolean', default: false })
  hasClaimedDailyReward: boolean;

  @Column({ type: 'date', nullable: true })
  lastDailyRewardDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Calculated properties
  get winRate(): number {
    return this.totalMatches > 0 ? (this.wins / this.totalMatches) * 100 : 0;
  }

  get rankName(): string {
    return RANK_NAMES[this.currentRank];
  }

  get canRefreshOpponents(): boolean {
    if (!this.lastOpponentRefreshAt) return true;
    const now = new Date();
    const diff = now.getTime() - this.lastOpponentRefreshAt.getTime();
    return diff >= 60000; // 60 seconds
  }

  get canFight(): boolean {
    if (!this.lastMatchAt) return true;
    const now = new Date();
    const diff = now.getTime() - this.lastMatchAt.getTime();
    return diff >= 60000; // 60 seconds
  }
}
