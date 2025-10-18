import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPositionNumbersToUserScratchCards1765100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'user_scratch_cards';

    // Add position_numbers column if it doesn't already exist
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const exists = table.columns.some((c) => c.name === 'position_numbers');
    if (!exists) {
      await queryRunner.addColumn(
        tableName,
        new TableColumn({
          name: 'position_numbers',
          type: 'jsonb',
          isNullable: false,
          default: "'[]'",
          comment:
            'Array of numbers assigned to each position (1-9 for 3x3 grid)',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'user_scratch_cards';
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const exists = table.columns.some((c) => c.name === 'position_numbers');
    if (exists) {
      await queryRunner.dropColumn(tableName, 'position_numbers');
    }
  }
}
