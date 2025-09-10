import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateItemEntityForConsumables1734567890124
  implements MigrationInterface
{
  name = 'UpdateItemEntityForConsumables1734567890124';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns
    await queryRunner.query(
      `ALTER TABLE "item" ADD "consumableType" varchar(50)`,
    );

    // Update existing type column to use enum values
    await queryRunner.query(
      `UPDATE "item" SET "type" = 'material' WHERE "type" IS NULL OR "type" = ''`,
    );
    await queryRunner.query(
      `UPDATE "item" SET "type" = 'consumable' WHERE "type" = 'potion' OR "type" = 'consumable'`,
    );

    // Update consumableType for existing consumable items
    await queryRunner.query(
      `UPDATE "item" SET "consumableType" = 'hp_potion' WHERE "type" = 'consumable' AND "name" LIKE '%hp%'`,
    );
    await queryRunner.query(
      `UPDATE "item" SET "consumableType" = 'exp_potion' WHERE "type" = 'consumable' AND "name" LIKE '%exp%'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "consumableType"`);
  }
}
