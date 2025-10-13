import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCostItemToPetBanners1760600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE pet_banners ADD COLUMN IF NOT EXISTS cost_item_id integer NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE pet_banners ADD COLUMN IF NOT EXISTS cost_item_quantity integer DEFAULT 1;`,
    );
    // Note: we do not add a foreign key constraint to keep migration simple
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE pet_banners DROP COLUMN IF EXISTS cost_item_quantity;`,
    );
    await queryRunner.query(
      `ALTER TABLE pet_banners DROP COLUMN IF EXISTS cost_item_id;`,
    );
  }
}
