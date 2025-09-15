import { IsInt, Min } from 'class-validator';

export class PlaceOfferDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsInt()
  @Min(1)
  quantity: number;
}
