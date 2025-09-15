import { IsInt, Min } from 'class-validator';

export class CreateListingDto {
  @IsInt()
  userItemId: number;

  @IsInt()
  @Min(0)
  price: number;

  @IsInt()
  @Min(1)
  quantity: number;
}
