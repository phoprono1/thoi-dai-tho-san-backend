import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddPendingAdvancementTable1759123456789
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'pending_advancements',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'userId',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'options',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            default: "'available'",
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Create index for efficient queries
    await queryRunner.createIndex(
      'pending_advancements',
      new TableIndex({
        name: 'IDX_pending_advancements_userId_status',
        columnNames: ['userId', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('pending_advancements');
  }
}
