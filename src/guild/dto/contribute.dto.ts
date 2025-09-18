import { IsInt, Min } from 'class-validator';

export class ContributeDto {
  @IsInt()
  @Min(1)
  amount: number;
}
