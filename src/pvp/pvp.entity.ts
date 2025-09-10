import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum PvpMatchStatus {
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PvpMatchType {
  ONE_VS_ONE = 'ONE_VS_ONE',
  FIVE_VS_FIVE = 'FIVE_VS_FIVE',
  TEN_VS_TEN = 'TEN_VS_TEN',
}

export enum PvpTeam {
  TEAM_A = 'TEAM_A',
  TEAM_B = 'TEAM_B',
}

@Entity('pvp_matches')
export class PvpMatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: PvpMatchType,
    default: PvpMatchType.ONE_VS_ONE,
  })
  matchType: PvpMatchType;

  @Column({
    type: 'enum',
    enum: PvpMatchStatus,
    default: PvpMatchStatus.WAITING,
  })
  status: PvpMatchStatus;

  @Column({ nullable: true })
  winnerTeam: PvpTeam;

  @Column({ type: 'int', default: 0 })
  teamAScore: number;

  @Column({ type: 'int', default: 0 })
  teamBScore: number;

  @Column({ type: 'int', default: 0 })
  maxPlayersPerTeam: number;

  @Column({ type: 'int', default: 0 })
  currentPlayersTeamA: number;

  @Column({ type: 'int', default: 0 })
  currentPlayersTeamB: number;

  @Column({ type: 'json', nullable: true })
  matchResult: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => PvpPlayer, (player) => player.match, { cascade: true })
  players: PvpPlayer[];
}

@Entity('pvp_players')
export class PvpPlayer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => PvpMatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matchId' })
  match: PvpMatch;

  @Column()
  matchId: number;

  @Column({
    type: 'enum',
    enum: PvpTeam,
  })
  team: PvpTeam;

  @Column({ type: 'int', default: 0 })
  damageDealt: number;

  @Column({ type: 'int', default: 0 })
  damageTaken: number;

  @Column({ type: 'int', default: 0 })
  kills: number;

  @Column({ type: 'int', default: 0 })
  deaths: number;

  @Column({ type: 'int', default: 0 })
  assists: number;

  @Column({ type: 'boolean', default: false })
  isReady: boolean;

  @Column({ type: 'json', nullable: true })
  playerStats: any;

  @CreateDateColumn()
  joinedAt: Date;
}
