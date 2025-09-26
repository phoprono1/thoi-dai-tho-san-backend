import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BossSchedule } from './boss-schedule.entity';
import { BossTemplate } from './boss-template.entity';

export enum BossStatus {
  ALIVE = 'alive',
  DEAD = 'dead',
  RESPAWNING = 'respawning',
  SCHEDULED = 'scheduled', // Boss được lên lịch nhưng chưa spawn
}

export enum BossDisplayMode {
  HEALTH_BAR = 'health_bar', // Hiển thị thanh máu truyền thống
  DAMAGE_BAR = 'damage_bar', // Hiển thị thanh damage với phases
}

@Entity('world_boss')
export class WorldBoss {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'integer' })
  maxHp: number;

  @Column({ type: 'integer', default: 0 })
  currentHp: number;

  @Column({ type: 'integer' })
  level: number;

  @Column({ type: 'jsonb' })
  stats: {
    attack: number;
    defense: number;
    critRate: number;
    critDamage: number;
  };

  @Column({
    type: 'enum',
    enum: BossStatus,
    default: BossStatus.ALIVE,
  })
  status: BossStatus;

  @Column({
    type: 'enum',
    enum: BossDisplayMode,
    default: BossDisplayMode.DAMAGE_BAR,
  })
  displayMode: BossDisplayMode;

  @Column({ type: 'timestamp', nullable: true })
  respawnTime: Date;

  @Column({ type: 'integer', default: 1 })
  spawnCount: number; // Số lần boss đã respawn

  @Column({ type: 'integer', default: 60 })
  durationMinutes: number; // Thời gian tồn tại của boss (phút)

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date; // Thời gian boss kết thúc

  @Column({ type: 'timestamp', nullable: true })
  scheduledStartTime: Date; // Thời gian boss được lên lịch bắt đầu

  @Column({ type: 'jsonb' })
  scalingConfig: {
    hpMultiplier: number; // Nhân HP mỗi lần respawn
    statMultiplier: number; // Nhân stats mỗi lần respawn
    rewardMultiplier: number; // Nhân rewards mỗi lần respawn
    maxSpawnCount: number; // Giới hạn số lần respawn
  };

  @Column({ type: 'jsonb' })
  damagePhases: {
    phase1Threshold: number; // Damage cần để đạt x1
    phase2Threshold: number; // Damage cần để đạt x2
    phase3Threshold: number; // Damage cần để đạt x3
    currentPhase: number; // Phase hiện tại (1, 2, 3)
    totalDamageReceived: number; // Tổng damage đã nhận
  };

  @Column({ type: 'jsonb' })
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

  @Column({ type: 'integer', nullable: true })
  scheduleId: number; // Reference to BossSchedule

  @ManyToOne(() => BossSchedule, { nullable: true })
  @JoinColumn({ name: 'scheduleId' })
  schedule: BossSchedule;

  @Column({ type: 'integer', nullable: true })
  templateId: number; // Reference to BossTemplate

  @ManyToOne(() => BossTemplate, { nullable: true })
  @JoinColumn({ name: 'templateId' })
  template: BossTemplate;

  @Column({ type: 'jsonb', nullable: true })
  customRewards?: {
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
  }; // Override rewards for this specific boss instance

  @Column({ type: 'integer', default: 50 })
  maxCombatTurns: number; // Số turn tối đa trước khi boss giết player

  @Column({ type: 'text', nullable: true })
  image?: string; // relative path or URL to boss image (e.g. /assets/world-boss/dragon.png)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
