import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

export enum UpgradeResult {
  SUCCESS = 'success',
  FAILED = 'failed',
  CRITICAL_SUCCESS = 'critical_success',
}

@Entity()
export class UpgradeLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userItemId: number;

  @Column()
  userId: number;

  @Column()
  previousLevel: number;

  @Column()
  targetLevel: number;

  @Column({
    type: 'enum',
    enum: UpgradeResult,
  })
  result: UpgradeResult;

  @Column()
  cost: number;

  @Column({ default: 0 })
  luckyCharmsUsed: number;

  @Column('float')
  successRate: number;

  @Column('json', { nullable: true })
  statsBonus: {
    attack?: number;
    defense?: number;
    critRate?: number;
    critDamage?: number;
    comboRate?: number;
    counterRate?: number;
    lifesteal?: number;
    armorPen?: number;
    dodgeRate?: number;
    accuracy?: number;
  };

  @CreateDateColumn()
  createdAt: Date;
}
