import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePositionColumnsFromScratchCardTypePrize1765200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop positionRow and positionCol columns from scratch_card_type_prizes table
    await queryRunner.query(
      `ALTER TABLE scratch_card_type_prizes DROP COLUMN position_row`,
    );
    await queryRunner.query(
      `ALTER TABLE scratch_card_type_prizes DROP COLUMN position_col`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add back the columns in down migration
    await queryRunner.query(
      `ALTER TABLE scratch_card_type_prizes ADD COLUMN position_row INT NOT NULL DEFAULT -1`,
    );
    await queryRunner.query(
      `ALTER TABLE scratch_card_type_prizes ADD COLUMN position_col INT NOT NULL DEFAULT -1`,
    );
  }
}
