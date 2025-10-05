import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AbilityType, TargetType } from '../interfaces/pet-ability.interface';

export class CreatePetAbilityDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['attack', 'heal', 'buff', 'debuff', 'utility'])
  type: AbilityType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  effects: any; // JSONB - will be validated by database

  @IsNumber()
  @IsOptional()
  cooldown?: number;

  @IsNumber()
  @IsOptional()
  manaCost?: number;

  @IsEnum(['enemy', 'all_enemies', 'ally', 'all_allies', 'self'])
  targetType: TargetType;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsNumber()
  @IsOptional()
  rarity?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
