import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMissingColumnsToPetAbilities1759650000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if columns exist
    const table = await queryRunner.getTable('pet_abilities');
    const cooldownColumn = table?.columns.find(
      (col) => col.name === 'cooldown',
    );
    const manaCostColumn = table?.columns.find(
      (col) => col.name === 'manaCost',
    );
    const targetTypeColumn = table?.columns.find(
      (col) => col.name === 'targetType',
    );

    if (!cooldownColumn) {
      await queryRunner.addColumn(
        'pet_abilities',
        new TableColumn({
          name: 'cooldown',
          type: 'int',
          default: 0,
          comment: 'Turns until ability can be used again',
        }),
      );
      console.log('Added cooldown column to pet_abilities');
    }

    if (!manaCostColumn) {
      await queryRunner.addColumn(
        'pet_abilities',
        new TableColumn({
          name: 'manaCost',
          type: 'int',
          default: 0,
          comment: 'Mana cost (future feature)',
        }),
      );
      console.log('Added manaCost column to pet_abilities');
    }

    if (!targetTypeColumn) {
      await queryRunner.addColumn(
        'pet_abilities',
        new TableColumn({
          name: 'targetType',
          type: 'varchar',
          length: '20',
          default: "'enemy'",
          comment: 'enemy, ally, self, all_enemies, all_allies',
        }),
      );
      console.log('Added targetType column to pet_abilities');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('pet_abilities');

    if (table?.columns.find((col) => col.name === 'targetType')) {
      await queryRunner.dropColumn('pet_abilities', 'targetType');
    }
    if (table?.columns.find((col) => col.name === 'manaCost')) {
      await queryRunner.dropColumn('pet_abilities', 'manaCost');
    }
    if (table?.columns.find((col) => col.name === 'cooldown')) {
      await queryRunner.dropColumn('pet_abilities', 'cooldown');
    }
  }
}
