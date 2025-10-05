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
    actor: 'player' | 'enemy' | 'pet';
    actorName: string;
    petId?: number; // ID of the pet (if actor is 'pet')
    targetName: string;
    targetIndex?: number; // For multiple enemies with same name
    damage?: number;
    damageType?: string; // Physical, magical, or true damage
    isCritical?: boolean;
    isMiss?: boolean;
    hpBefore: number;
    hpAfter: number;
    manaBefore?: number; // Mana before action
    manaAfter?: number; // Mana after action
    manaCost?: number; // Mana consumed by the action
    description: string;
    abilityIcon?: string; // Icon for pet abilities
    effects?: string[];
  };

  @CreateDateColumn()
  createdAt: Date;
}
