import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { PvpSeason } from './pvp-season.entity';

@Entity('pvp_matches_new')
export class PvpMatch {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challengerId' })
  challenger: User;

  @Column()
  challengerId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'defenderId' })
  defender: User;

  @Column()
  defenderId: number;

  @ManyToOne(() => PvpSeason, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seasonId' })
  season: PvpSeason;

  @Column()
  seasonId: number;

  @Column({ nullable: true })
  winnerId: number;

  @Column({ type: 'int' })
  challengerPointsBefore: number;

  @Column({ type: 'int' })
  defenderPointsBefore: number;

  @Column({ type: 'int' })
  challengerPointsAfter: number;

  @Column({ type: 'int' })
  defenderPointsAfter: number;

  @Column({ type: 'int' })
  pointsChange: number; // Points gained/lost by challenger

  @Column({ type: 'json', nullable: true })
  combatResult: {
    result: 'victory' | 'defeat';
    turns: number;
    logs: any[];
    finalPlayers: any[];
    finalEnemies: any[];
    seedUsed?: number | string;
  };

  @Column({ type: 'int', nullable: true })
  combatSeed: number;

  @CreateDateColumn()
  createdAt: Date;

  get isWin(): boolean {
    return this.winnerId === this.challengerId;
  }
}
