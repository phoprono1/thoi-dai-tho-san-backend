import { IsInt } from 'class-validator';

export class BuyShopDto {
  @IsInt()
  shopItemId: number;
}
