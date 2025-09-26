import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

@Entity('boss_schedule')
export class BossSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: DayOfWeek,
  })
  dayOfWeek: DayOfWeek;

  @Column({ type: 'time' })
  startTime: string; // Format: 'HH:MM:SS' e.g., '19:00:00'

  @Column({ type: 'integer', default: 120 })
  durationMinutes: number; // Thời gian boss tồn tại

  @Column({ type: 'jsonb' })
  bossTemplate: {
    name: string;
    description: string;
    level: number;
    image?: string; // Boss image path
    stats: {
      attack: number;
      defense: number;
      critRate: number;
      critDamage: number;
    };
    damagePhases: {
      phase1Threshold: number; // Damage cần để đạt x1
      phase2Threshold: number; // Damage cần để đạt x2
      phase3Threshold: number; // Damage cần để đạt x3
    };
    rewards: {
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
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 50, default: 'Asia/Ho_Chi_Minh' })
  timezone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
