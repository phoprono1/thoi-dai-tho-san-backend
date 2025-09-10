import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConsumableValueAndDuration1734567890125
  implements MigrationInterface
{
  name = 'AddConsumableValueAndDuration1734567890125';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add consumableValue column
    await queryRunner.query(`ALTER TABLE "item" ADD "consumableValue" integer`);

    // Add duration column
    await queryRunner.query(`ALTER TABLE "item" ADD "duration" integer`);

    // Update existing consumable items with default values
    await queryRunner.query(
      `UPDATE "item" SET "consumableValue" = 50 WHERE "type" = 'consumable' AND "consumableType" = 'hp_potion'`,
    );
    await queryRunner.query(
      `UPDATE "item" SET "consumableValue" = 100 WHERE "type" = 'consumable' AND "consumableType" = 'exp_potion'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "duration"`);
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "consumableValue"`);
  }
}
