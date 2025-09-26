/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { BossStatus, BossDisplayMode } from './world-boss.entity';
import { DayOfWeek } from './boss-schedule.entity';

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

  @IsOptional()
  @IsObject()
  rewards?: {
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

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsObject()
  scalingConfig?: {
    hpMultiplier: number;
    statMultiplier: number;
    rewardMultiplier: number;
    maxSpawnCount: number;
  };

  @IsOptional()
  @IsEnum(BossDisplayMode)
  displayMode?: BossDisplayMode;

  @IsOptional()
  @IsObject()
  damagePhases?: {
    phase1Threshold: number;
    phase2Threshold: number;
    phase3Threshold: number;
  };

  @IsOptional()
  @IsNumber()
  maxCombatTurns?: number;

  @IsOptional()
  @IsString()
  image?: string;
}

export class CreateBossScheduleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @IsString()
  startTime: string; // 'HH:MM:SS'

  @IsNumber()
  durationMinutes: number;

  @IsObject()
  bossTemplate: {
    name: string;
    description: string;
    level: number;
    stats: {
      attack: number;
      defense: number;
      critRate: number;
      critDamage: number;
    };
    damagePhases: {
      phase1Threshold: number;
      phase2Threshold: number;
      phase3Threshold: number;
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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class WorldBossResponseDto {
  id: number;
  name: string;
  description: string;
  maxHp: number;
  currentHp: number;
  level: number;
  stats: {
    attack: number;
    defense: number;
    critRate: number;
    critDamage: number;
  };
  status: BossStatus;
  displayMode: BossDisplayMode;
  respawnTime?: Date;
  spawnCount: number;
  durationMinutes: number;
  endTime?: Date;
  scheduledStartTime?: Date;
  scalingConfig: {
    hpMultiplier: number;
    statMultiplier: number;
    rewardMultiplier: number;
    maxSpawnCount: number;
  };
  damagePhases: {
    phase1Threshold: number;
    phase2Threshold: number;
    phase3Threshold: number;
    currentPhase: number;
    totalDamageReceived: number;
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
  scheduleId?: number;
  maxCombatTurns: number;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AttackBossDto {
  // No damage input needed - calculated by combat engine
}

export class BossCombatResultDto {
  success: boolean;
  damage: number;
  bossHpBefore: number;
  bossHpAfter: number;
  isBossDead: boolean;
  combatLogs?: any[];
  currentPhase?: number;
  totalDamageReceived?: number;
  rewards?: any;
  nextRespawnTime?: Date;
}

export class BossRankingDto {
  individual: Array<{
    rank: number;
    userId: number;
    username: string;
    totalDamage: number;
    attackCount: number;
    lastDamage: number;
  }>;
  guild: Array<{
    rank: number;
    guildId: number;
    guildName: string;
    totalDamage: number;
    attackCount: number;
    lastDamage: number;
  }>;
}

export class BossScheduleResponseDto {
  id: number;
  name: string;
  description?: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  durationMinutes: number;
  bossTemplate: any;
  isActive: boolean;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

// Boss Template DTOs
export class CreateBossTemplateDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  level: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsObject()
  stats: {
    attack: number;
    defense: number;
    critRate: number;
    critDamage: number;
  };

  @IsObject()
  damagePhases: {
    phase1Threshold: number;
    phase2Threshold: number;
    phase3Threshold: number;
  };

  @IsObject()
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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  category?: string;
}

export class UpdateBossTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  level?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsObject()
  stats?: {
    attack: number;
    defense: number;
    critRate: number;
    critDamage: number;
  };

  @IsOptional()
  @IsObject()
  damagePhases?: {
    phase1Threshold: number;
    phase2Threshold: number;
    phase3Threshold: number;
  };

  @IsOptional()
  @IsObject()
  defaultRewards?: {
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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  category?: string;
}

export class BossTemplateResponseDto {
  id: number;
  name: string;
  description: string;
  level: number;
  image?: string;
  stats: {
    attack: number;
    defense: number;
    critRate: number;
    critDamage: number;
  };
  damagePhases: {
    phase1Threshold: number;
    phase2Threshold: number;
    phase3Threshold: number;
  };
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
  isActive: boolean;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced DTOs for new functionality
export class CreateBossFromTemplateDto {
  @IsNumber()
  templateId: number;

  @IsOptional()
  @IsNumber()
  scheduleId?: number;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsObject()
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
  };
}

export class AssignBossToScheduleDto {
  @IsNumber()
  bossId: number;

  @IsNumber()
  scheduleId: number;
}

export class RemoveBossFromScheduleDto {
  @IsNumber()
  bossId: number;
}
