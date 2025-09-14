import { IsInt, Min } from 'class-validator';

export class CreateListingDto {
  @IsInt()
  itemId: number;

  @IsInt()
  @Min(0)
  price: number;
}
