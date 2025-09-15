import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMarketListingQuantity1694780000000
  implements MigrationInterface
{
  name = 'AddMarketListingQuantity1694780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add column with default 1 if not exists, set existing nulls to 1, make not null
    await queryRunner.query(
      `ALTER TABLE "market_listing" ADD COLUMN IF NOT EXISTS "quantity" integer DEFAULT 1;`,
    );
    await queryRunner.query(
      `UPDATE "market_listing" SET "quantity" = 1 WHERE "quantity" IS NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE "market_listing" ALTER COLUMN "quantity" SET NOT NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "market_listing" DROP COLUMN "quantity";`,
    );
  }
}
