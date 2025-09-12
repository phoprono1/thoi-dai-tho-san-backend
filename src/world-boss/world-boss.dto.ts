/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsObject,
} from 'class-validator';
import { BossStatus } from './world-boss.entity';

export class CreateWorldBossDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  maxHp: number;

  @IsNumber()
  level: number;

  @IsObject()
  stats: {
    attack: number;
    defense: number;
    critRate: number;
    critDamage: number;
  };

  @IsObject()
  rewards: {
    gold: number;
    experience: number;
    items: Array<{
      itemId: number;
      quantity: number;
      dropRate: number;
    }>;
  };

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsObject()
  scalingConfig: {
    hpMultiplier: number;
    statMultiplier: number;
    rewardMultiplier: number;
    maxSpawnCount: number;
  };
}

export class WorldBossResponseDto {
  id: number;
  name: string;
  description: string;
  maxHp: number;
  currentHp: number;
  level: number;
  stats: any;
  status: BossStatus;
  respawnTime?: Date;
  spawnCount: number;
  durationMinutes: number;
  endTime?: Date;
  scalingConfig: any;
  rewards: any;
  createdAt: Date;
  updatedAt: Date;
}

export class AttackBossDto {
  @IsNumber()
  damage: number;
}

export class BossCombatResultDto {
  success: boolean;
  damage: number;
  bossHpBefore: number;
  bossHpAfter: number;
  isBossDead: boolean;
  rewards?: any;
  nextRespawnTime?: Date;
}
