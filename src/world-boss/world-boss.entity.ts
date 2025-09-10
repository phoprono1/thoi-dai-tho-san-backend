import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BossStatus {
  ALIVE = 'alive',
  DEAD = 'dead',
  RESPAWNING = 'respawning',
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

  @Column({ type: 'timestamp', nullable: true })
  respawnTime: Date;

  @Column({ type: 'integer', default: 1 })
  spawnCount: number; // Số lần boss đã respawn

  @Column({ type: 'integer', default: 60 })
  durationMinutes: number; // Thời gian tồn tại của boss (phút)

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date; // Thời gian boss kết thúc

  @Column({ type: 'jsonb' })
  scalingConfig: {
    hpMultiplier: number; // Nhân HP mỗi lần respawn
    statMultiplier: number; // Nhân stats mỗi lần respawn
    rewardMultiplier: number; // Nhân rewards mỗi lần respawn
    maxSpawnCount: number; // Giới hạn số lần respawn
  };

  @Column({ type: 'jsonb' })
  rewards: {
    gold: number;
    experience: number;
    items: Array<{
      itemId: number;
      quantity: number;
      dropRate: number;
    }>;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
