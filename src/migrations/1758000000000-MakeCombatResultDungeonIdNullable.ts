import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeCombatResultDungeonIdNullable1758000000000
  implements MigrationInterface
{
  name = 'MakeCombatResultDungeonIdNullable1758000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Convert legacy sentinel value 0 to NULL, then allow NULLs on the column
    await queryRunner.query(
      `UPDATE "combat_result" SET "dungeonId" = NULL WHERE "dungeonId" = 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "combat_result" ALTER COLUMN "dungeonId" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: set NULLs back to 0 and make the column NOT NULL again
    await queryRunner.query(
      `UPDATE "combat_result" SET "dungeonId" = 0 WHERE "dungeonId" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "combat_result" ALTER COLUMN "dungeonId" SET NOT NULL`,
    );
  }
}
