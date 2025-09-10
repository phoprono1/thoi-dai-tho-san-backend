import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsObject,
  IsDateString,
} from 'class-validator';
import { MailType } from './mailbox.entity';

export class SendMailDto {
  @IsNumber()
  userId: number;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsEnum(MailType)
  type: MailType;

  @IsOptional()
  @IsObject()
  rewards?: {
    gold?: number;
    experience?: number;
    items?: Array<{
      itemId: number;
      quantity: number;
    }>;
  };

  @IsOptional()
  @IsDateString()
  expiresAt?: Date;
}
