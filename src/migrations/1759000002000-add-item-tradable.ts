import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddItemTradable1759000002000 implements MigrationInterface {
  name = 'AddItemTradable1759000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'tradable' boolean column defaulting to true for backwards compatibility
    await queryRunner.query(
      `ALTER TABLE "item" ADD COLUMN IF NOT EXISTS "tradable" boolean DEFAULT true`,
    );

    // Ensure existing rows get an explicit true value (some DBs will handle DEFAULT for new rows only)
    await queryRunner.query(
      `UPDATE "item" SET "tradable" = true WHERE "tradable" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "item" DROP COLUMN IF EXISTS "tradable"`,
    );
  }
}
