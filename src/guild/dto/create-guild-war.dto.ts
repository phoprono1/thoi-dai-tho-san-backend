import { IsInt, IsOptional, IsISO8601 } from 'class-validator';

export class CreateGuildWarDto {
  @IsInt()
  opponentGuildId: number;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
