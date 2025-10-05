import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreatePetUpgradeMaterials1733500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create pet_upgrade_materials table
    await queryRunner.createTable(
      new Table({
        name: 'pet_upgrade_materials',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'petDefinitionId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'level',
            type: 'int',
            isNullable: false,
            comment: 'Target level this material requirement is for',
          },
          {
            name: 'materialItemId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'quantity',
            type: 'int',
            isNullable: false,
            default: 1,
          },
          {
            name: 'goldCost',
            type: 'int',
            isNullable: false,
            default: 0,
          },
          {
            name: 'statIncrease',
            type: 'jsonb',
            isNullable: true,
            comment: 'Stat increases when reaching this level',
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add foreign key to pet_definitions
    await queryRunner.createForeignKey(
      'pet_upgrade_materials',
      new TableForeignKey({
        columnNames: ['petDefinitionId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'pet_definitions',
        onDelete: 'CASCADE',
        name: 'fk_pet_upgrade_materials_pet_definition',
      }),
    );

    // Add foreign key to item table
    await queryRunner.createForeignKey(
      'pet_upgrade_materials',
      new TableForeignKey({
        columnNames: ['materialItemId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'item',
        onDelete: 'CASCADE',
        name: 'fk_pet_upgrade_materials_item',
      }),
    );

    // Add index for efficient lookups
    await queryRunner.createIndex(
      'pet_upgrade_materials',
      new TableIndex({
        name: 'idx_pet_upgrade_materials_pet_level',
        columnNames: ['petDefinitionId', 'level'],
      }),
    );

    // Add index on materialItemId for reverse lookups
    await queryRunner.createIndex(
      'pet_upgrade_materials',
      new TableIndex({
        name: 'idx_pet_upgrade_materials_material',
        columnNames: ['materialItemId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex(
      'pet_upgrade_materials',
      'idx_pet_upgrade_materials_material',
    );
    await queryRunner.dropIndex(
      'pet_upgrade_materials',
      'idx_pet_upgrade_materials_pet_level',
    );

    // Drop foreign keys
    await queryRunner.dropForeignKey(
      'pet_upgrade_materials',
      'fk_pet_upgrade_materials_item',
    );
    await queryRunner.dropForeignKey(
      'pet_upgrade_materials',
      'fk_pet_upgrade_materials_pet_definition',
    );

    // Drop table
    await queryRunner.dropTable('pet_upgrade_materials');
  }
}
