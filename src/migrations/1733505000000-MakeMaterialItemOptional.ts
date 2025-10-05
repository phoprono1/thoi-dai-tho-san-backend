import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeMaterialItemOptional1733505000000
  implements MigrationInterface
{
  name = 'MakeMaterialItemOptional1733505000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make materialItemId and quantity nullable to support gold-only upgrades
    await queryRunner.query(`
      ALTER TABLE "pet_upgrade_materials" 
      ALTER COLUMN "materialItemId" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "pet_upgrade_materials" 
      ALTER COLUMN "quantity" DROP NOT NULL
    `);

    console.log(
      '✅ Migration: Material items are now optional for pet upgrades',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: Make columns NOT NULL again
    // Note: This will fail if there are rows with NULL values
    await queryRunner.query(`
      ALTER TABLE "pet_upgrade_materials" 
      ALTER COLUMN "materialItemId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "pet_upgrade_materials" 
      ALTER COLUMN "quantity" SET NOT NULL
    `);

    console.log('⏪ Migration reverted: Material items are required again');
  }
}
