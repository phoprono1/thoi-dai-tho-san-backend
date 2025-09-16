import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Dungeon } from '../dungeons/dungeon.entity';

export enum CombatResultType {
  VICTORY = 'victory',
  DEFEAT = 'defeat',
  ESCAPE = 'escape',
}

@Entity()
export class CombatResult {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Dungeon, { onDelete: 'CASCADE' })
  @JoinColumn()
  dungeon: Dungeon;

  @Column()
  dungeonId: number;

  @Column('json')
  userIds: number[];

  @Column('json', { nullable: true })
  teamStats: {
    totalHp: number;
    currentHp: number;
    members: {
      userId: number;
      username: string;
      hp: number;
      maxHp: number;
    }[];
  };

  @Column({
    type: 'enum',
    enum: CombatResultType,
  })
  result: CombatResultType;

  @Column()
  duration: number; // Thời gian combat (ms)

  @Column('json', { nullable: true })
  rewards: {
    experience?: number;
    gold?: number;
    items?: { itemId: number; quantity: number }[];
  };

  @Column({ nullable: true })
  seed?: string;

  @OneToMany('CombatLog', 'combatResult', { cascade: true })
  logs: any[];

  @CreateDateColumn()
  createdAt: Date;
}
