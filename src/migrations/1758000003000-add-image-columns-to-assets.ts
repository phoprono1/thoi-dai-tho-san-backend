import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageColumnsToAssets1758000003000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "monsters" ADD COLUMN IF NOT EXISTS "image" text`,
    );

    await queryRunner.query(
      `ALTER TABLE "dungeon" ADD COLUMN IF NOT EXISTS "image" text`,
    );

    await queryRunner.query(
      `ALTER TABLE "item" ADD COLUMN IF NOT EXISTS "image" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "monsters" DROP COLUMN IF EXISTS "image"`,
    );

    await queryRunner.query(
      `ALTER TABLE "dungeon" DROP COLUMN IF EXISTS "image"`,
    );

    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN IF EXISTS "image"`);
  }
}
