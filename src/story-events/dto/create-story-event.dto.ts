import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsObject,
  ValidateNested,
  IsIn,
  IsNumber,
  Min,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

class ItemPoolDto {
  @IsNumber()
  itemId: number;

  @IsNumber()
  @Min(0)
  qty: number;
}

class ItemsPerPointDto {
  @IsNumber()
  itemId: number;

  @IsNumber()
  @Min(0)
  qtyPerPoint: number;
}

class RewardConfigDto {
  @IsOptional()
  @IsIn(['pool', 'perPoint'])
  mode?: 'pool' | 'perPoint';

  @IsOptional()
  @IsNumber()
  @Min(0)
  goldPool?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  goldPerPoint?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPoolDto)
  itemPools?: ItemPoolDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemsPerPointDto)
  itemsPerPoint?: ItemsPerPointDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minGold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minItem?: number;
}

class DungeonReqDto {
  @IsNumber()
  dungeonId: number;

  @IsNumber()
  @Min(1)
  count: number;
}

class EnemyReqDto {
  @IsString()
  enemyType: string;

  @IsNumber()
  @Min(1)
  count: number;
}

class ItemReqDto {
  @IsNumber()
  itemId: number;

  @IsNumber()
  @Min(1)
  quantity: number;
}

class RequirementsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DungeonReqDto)
  completeDungeons?: DungeonReqDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnemyReqDto)
  killEnemies?: EnemyReqDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemReqDto)
  collectItems?: ItemReqDto[];

  @IsOptional()
  @IsBoolean()
  defeatBoss?: boolean;
}

class ScoringWeightsDto {
  @IsOptional()
  @IsNumber()
  dungeonClear?: number;

  @IsOptional()
  @IsNumber()
  enemyKill?: number;

  @IsOptional()
  @IsNumber()
  itemDonate?: number;

  @IsOptional()
  @IsNumber()
  bossDefeat?: number;
}

export class CreateStoryEventDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  descriptionHtml?: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsDateString()
  eventStart?: string;

  @IsOptional()
  @IsDateString()
  eventEnd?: string;

  @IsOptional()
  @IsBoolean()
  participationRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  globalEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  globalTarget?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RewardConfigDto)
  rewardConfig?: RewardConfigDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RequirementsDto)
  requirements?: RequirementsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ScoringWeightsDto)
  scoringWeights?: ScoringWeightsDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
