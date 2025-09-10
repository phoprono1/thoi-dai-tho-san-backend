import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { DonorStatus, DonorTier } from './donor.entity';

export class CreateDonorDto {
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @IsNotEmpty()
  @IsEnum(DonorTier)
  tier: DonorTier;

  @IsOptional()
  @IsString()
  message?: string;

  @IsNotEmpty()
  @IsDateString()
  donationDate: Date;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean = false;

  @IsOptional()
  metadata?: {
    paymentMethod?: string;
    transactionId?: string;
    platform?: string;
    campaignId?: string;
  };
}

export class UpdateDonorDto {
  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsEnum(DonorStatus)
  status?: DonorStatus;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  metadata?: {
    paymentMethod?: string;
    transactionId?: string;
    platform?: string;
    campaignId?: string;
  };
}

export class DonorResponseDto {
  id: number;
  userId: number;
  username: string;
  amount: number;
  currency: string;
  tier: DonorTier;
  message?: string;
  donationDate: Date;
  status: DonorStatus;
  isAnonymous: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export class DonorStatsDto {
  totalDonors: number;
  totalAmount: number;
  tierBreakdown: {
    [key in DonorTier]: number;
  };
  recentDonations: DonorResponseDto[];
}
