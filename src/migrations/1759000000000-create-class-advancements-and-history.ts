import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateClassAdvancementsAndHistory1759000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'character_class_advancements',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'fromClassId', type: 'integer', isNullable: false },
          { name: 'toClassId', type: 'integer', isNullable: false },
          { name: 'levelRequired', type: 'integer', isNullable: false },
          {
            name: 'weight',
            type: 'integer',
            isNullable: false,
            default: '100',
          },
          {
            name: 'allowPlayerChoice',
            type: 'boolean',
            isNullable: false,
            default: 'false',
          },
          {
            name: 'isAwakening',
            type: 'boolean',
            isNullable: false,
            default: 'false',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'character_class_advancements',
      new TableForeignKey({
        columnNames: ['fromClassId'],
        referencedTableName: 'character_classes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'character_class_advancements',
      new TableForeignKey({
        columnNames: ['toClassId'],
        referencedTableName: 'character_classes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'character_class_history',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'characterId', type: 'integer', isNullable: false },
          { name: 'previousClassId', type: 'integer', isNullable: true },
          { name: 'newClassId', type: 'integer', isNullable: false },
          { name: 'reason', type: 'varchar', length: '64', isNullable: false },
          { name: 'triggeredByUserId', type: 'integer', isNullable: true },
          {
            name: 'triggeredAt',
            type: 'timestamp',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'character_class_history',
      new TableForeignKey({
        columnNames: ['previousClassId'],
        referencedTableName: 'character_classes',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'character_class_history',
      new TableForeignKey({
        columnNames: ['newClassId'],
        referencedTableName: 'character_classes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('character_class_history', true);
    await queryRunner.dropTable('character_class_advancements', true);
  }
}
