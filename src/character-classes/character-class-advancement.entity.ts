import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CharacterClass } from './character-class.entity';

@Entity('character_class_advancements')
export class CharacterClassAdvancement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  fromClassId: number;

  @ManyToOne(() => CharacterClass)
  @JoinColumn({ name: 'fromClassId' })
  fromClass: CharacterClass;

  @Column({ type: 'integer' })
  toClassId: number;

  @ManyToOne(() => CharacterClass)
  @JoinColumn({ name: 'toClassId' })
  toClass: CharacterClass;

  @Column({ type: 'integer' })
  levelRequired: number;

  @Column({ type: 'integer', default: 100 })
  weight: number;

  @Column({ type: 'boolean', default: false })
  allowPlayerChoice: boolean;

  @Column({ type: 'boolean', default: false })
  isAwakening: boolean;

  @Column({ type: 'jsonb', nullable: true })
  requirements?: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
