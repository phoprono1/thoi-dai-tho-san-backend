import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateGachaBoxTables1760000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'gacha_box',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'name', type: 'varchar' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'image', type: 'text', isNullable: true },
          { name: 'openMode', type: 'varchar', default: "'single'" },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'metadata', type: 'json', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'gacha_box_entry',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'boxId', type: 'int' },
          { name: 'itemId', type: 'int', isNullable: true },
          { name: 'itemJson', type: 'json', isNullable: true },
          { name: 'amountMin', type: 'int', default: 1 },
          { name: 'amountMax', type: 'int', default: 1 },
          { name: 'weight', type: 'int', isNullable: true },
          { name: 'probability', type: 'double precision', isNullable: true },
          { name: 'groupKey', type: 'varchar', isNullable: true },
          { name: 'guaranteed', type: 'boolean', default: false },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'gacha_box_open_log',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'playerId', type: 'int' },
          { name: 'boxId', type: 'int' },
          { name: 'awarded', type: 'json' },
          { name: 'usedKey', type: 'text', isNullable: true },
          { name: 'seed', type: 'bigint', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'gacha_box_entry',
      new TableForeignKey({
        columnNames: ['boxId'],
        referencedTableName: 'gacha_box',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('gacha_box_entry');
    if (table) {
      const fk = table.foreignKeys.find(
        (f) => f.columnNames.indexOf('boxId') !== -1,
      );
      if (fk) await queryRunner.dropForeignKey('gacha_box_entry', fk);
    }
    await queryRunner.dropTable('gacha_box_open_log');
    await queryRunner.dropTable('gacha_box_entry');
    await queryRunner.dropTable('gacha_box');
  }
}
