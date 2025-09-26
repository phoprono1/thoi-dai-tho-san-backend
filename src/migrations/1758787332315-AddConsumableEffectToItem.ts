import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConsumableEffectToItem1758787332315 implements MigrationInterface {
  name = 'AddConsumableEffectToItem1758787332315';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add consumableEffect column to item table
    await queryRunner.query(`
      ALTER TABLE "item" ADD COLUMN "consumableEffect" json
    `);

    // Update existing items with consumableEffect based on consumableType
    await queryRunner.query(`
      UPDATE "item" SET "consumableEffect" = '{"hp": 50}' 
      WHERE "consumableType" = 'hp_potion' AND "consumableEffect" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "item" SET "consumableEffect" = '{"energy": 30}' 
      WHERE "consumableType" = 'mp_potion' AND "consumableEffect" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "item" SET "consumableEffect" = '{"exp": 100}' 
      WHERE "consumableType" = 'exp_potion' AND "consumableEffect" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove consumableEffect column
    await queryRunner.query(`
      ALTER TABLE "item" DROP COLUMN "consumableEffect"
    `);
  }
}
