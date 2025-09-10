import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CombatResult } from './combat-result.entity';

export enum CombatActionType {
  ATTACK = 'attack',
  DEFEND = 'defend',
  SKILL = 'skill',
  ITEM = 'item',
  ESCAPE = 'escape',
}

@Entity()
export class CombatLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CombatResult, { onDelete: 'CASCADE' })
  @JoinColumn()
  combatResult: CombatResult;

  @Column()
  userId: number; // ID của user thực hiện action trong team

  @Column('int', { default: 1 })
  turn: number; // Lượt thứ bao nhiêu

  @Column('int', { default: 1 })
  actionOrder: number; // 1 = Player turn, 2 = Enemy turn trong cùng turn

  @Column({
    type: 'enum',
    enum: CombatActionType,
  })
  action: CombatActionType;

  @Column('json')
  details: {
    actor: 'player' | 'enemy';
    actorName: string;
    targetName: string;
    targetIndex?: number; // For multiple enemies with same name
    damage?: number;
    isCritical?: boolean;
    isMiss?: boolean;
    hpBefore: number;
    hpAfter: number;
    description: string;
    effects?: string[];
  };

  @CreateDateColumn()
  createdAt: Date;
}
