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
  ArrayNotEmpty,
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
  @IsBoolean()
  isActive?: boolean;
}
