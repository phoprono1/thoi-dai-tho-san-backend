import {
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  IsObject,
  IsNumber,
  Min,
} from 'class-validator';

export class UpdateStoryEventDto {
  @IsOptional()
  @IsString()
  title?: string;

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
  rewardConfig?: any;

  @IsOptional()
  @IsObject()
  requirements?: any;

  @IsOptional()
  @IsObject()
  scoringWeights?: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
