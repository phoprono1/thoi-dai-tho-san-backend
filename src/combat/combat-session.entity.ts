import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class CombatSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('json')
  players: { id: number; username: string; hp: number; maxHp: number }[];

  @Column('json')
  enemies: { name: string; hp: number; maxHp: number; attack: number }[];

  @Column({ default: 'ongoing' })
  status: string; // ongoing, completed, failed

  @Column({ nullable: true })
  winner: string; // 'players' or 'enemies'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
