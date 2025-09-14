import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDungeonDescription1694700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dungeon" ADD COLUMN IF NOT EXISTS "description" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dungeon" DROP COLUMN IF EXISTS "description"`,
    );
  }
}
