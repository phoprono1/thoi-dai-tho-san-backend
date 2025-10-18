import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserScratchCardColumns1765000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'user_scratch_cards';

    // Add columns if they don't already exist
    const addIfNotExists = async (column: TableColumn) => {
      const table = await queryRunner.getTable(tableName);
      if (!table) return;
      const exists = table.columns.some((c) => c.name === column.name);
      if (!exists) {
        await queryRunner.addColumn(tableName, column);
      }
    };

    await addIfNotExists(
      new TableColumn({
        name: 'player_number',
        type: 'int',
        isNullable: true,
      }),
    );

    await addIfNotExists(
      new TableColumn({
        name: 'scratched_positions',
        type: 'jsonb',
        isNullable: false,
        default: "'[]'",
      }),
    );

    await addIfNotExists(
      new TableColumn({
        name: 'revealed_prizes',
        type: 'jsonb',
        isNullable: false,
        default: "'[]'",
      }),
    );

    await addIfNotExists(
      new TableColumn({
        name: 'placed_prizes',
        type: 'jsonb',
        isNullable: false,
        default: "'[]'",
      }),
    );

    await addIfNotExists(
      new TableColumn({
        name: 'is_completed',
        type: 'boolean',
        default: false,
      }),
    );

    await addIfNotExists(
      new TableColumn({
        name: 'total_gold_won',
        type: 'int',
        default: 0,
      }),
    );

    await addIfNotExists(
      new TableColumn({
        name: 'total_items_won',
        type: 'jsonb',
        isNullable: false,
        default: "'[]'",
      }),
    );

    await addIfNotExists(
      new TableColumn({
        name: 'tax_deducted',
        type: 'int',
        default: 0,
      }),
    );

    await addIfNotExists(
      new TableColumn({
        name: 'final_gold_received',
        type: 'int',
        default: 0,
      }),
    );

    await addIfNotExists(
      new TableColumn({
        name: 'created_at',
        type: 'timestamp',
        default: 'now()',
      }),
    );

    await addIfNotExists(
      new TableColumn({
        name: 'completed_at',
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'user_scratch_cards';
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const dropIfExists = async (name: string) => {
      if (table.columns.some((c) => c.name === name)) {
        await queryRunner.dropColumn(tableName, name);
      }
    };

    await dropIfExists('completed_at');
    await dropIfExists('created_at');
    await dropIfExists('final_gold_received');
    await dropIfExists('tax_deducted');
    await dropIfExists('total_items_won');
    await dropIfExists('total_gold_won');
    await dropIfExists('is_completed');
    await dropIfExists('placed_prizes');
    await dropIfExists('revealed_prizes');
    await dropIfExists('scratched_positions');
    await dropIfExists('player_number');
  }
}
