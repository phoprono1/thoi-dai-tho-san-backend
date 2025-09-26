import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('boss_template')
export class BossTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'integer' })
  level: number;

  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'jsonb' })
  stats: {
    attack: number;
    defense: number;
    critRate: number;
    critDamage: number;
  };

  @Column({ type: 'jsonb' })
  damagePhases: {
    phase1Threshold: number;
    phase2Threshold: number;
    phase3Threshold: number;
  };

  @Column({ type: 'jsonb' })
  defaultRewards: {
    individual: {
      top1: { gold: number; experience: number; items: any[] };
      top2: { gold: number; experience: number; items: any[] };
      top3: { gold: number; experience: number; items: any[] };
      top4to10: { gold: number; experience: number; items: any[] };
      top11to30: { gold: number; experience: number; items: any[] };
    };
    guild: {
      top1: { gold: number; experience: number; items: any[] };
      top2to5: { gold: number; experience: number; items: any[] };
      top6to10: { gold: number; experience: number; items: any[] };
    };
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: string; // e.g., 'dragon', 'demon', 'elemental'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
