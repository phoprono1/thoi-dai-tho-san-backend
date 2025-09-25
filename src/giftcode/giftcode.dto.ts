export class CreateGiftCodeDto {
  code: string;
  rewards?: any;
  usesAllowed?: number | null;
  expiresAt?: Date | null;
}

export class RedeemGiftCodeDto {
  code: string;
}
