import { IsString, IsOptional, Length } from 'class-validator';

export class CreateGuildDto {
  @IsString()
  @Length(3, 32)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;
}
