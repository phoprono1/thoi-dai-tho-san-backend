import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddImageToWorldBoss1758787332310 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'world_boss',
      new TableColumn({
        name: 'image',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('world_boss', 'image');
  }
}
