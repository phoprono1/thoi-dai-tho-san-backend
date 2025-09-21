import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { CharacterClass } from './character-class.entity';

@Entity('character_class_history')
export class CharacterClassHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  characterId: number;

  @Column({ type: 'integer', nullable: true })
  previousClassId: number | null;

  @ManyToOne(() => CharacterClass, { nullable: true })
  @JoinColumn({ name: 'previousClassId' })
  previousClass: CharacterClass | null;

  @Column({ type: 'integer' })
  newClassId: number;

  @ManyToOne(() => CharacterClass)
  @JoinColumn({ name: 'newClassId' })
  newClass: CharacterClass;

  @Column({ type: 'varchar', length: 64 })
  reason: string; // e.g. 'awakening', 'promotion', 'admin'

  @Column({ type: 'integer', nullable: true })
  triggeredByUserId: number | null;

  @CreateDateColumn()
  triggeredAt: Date;
}
