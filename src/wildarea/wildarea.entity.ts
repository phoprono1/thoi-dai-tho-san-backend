import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Monster } from '../monsters/monster.entity';

@Entity('wildarea_monsters')
export class WildAreaMonster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  monsterId: number;

  @ManyToOne(() => Monster, { eager: true })
  @JoinColumn({ name: 'monsterId' })
  monster: Monster;

  @Column({ type: 'int', default: 1 })
  minLevel: number;

  @Column({ type: 'int', default: 50 })
  maxLevel: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1.0 })
  spawnWeight: number; // Weight for random selection (higher = more likely)

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string; // Admin notes about this monster in wildarea

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
