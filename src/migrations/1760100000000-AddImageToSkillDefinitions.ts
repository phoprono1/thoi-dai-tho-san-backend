import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddImageToSkillDefinitions1760100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add image column to skill_definitions table
    await queryRunner.addColumn(
      'skill_definitions',
      new TableColumn({
        name: 'image',
        type: 'varchar',
        length: '500',
        isNullable: true,
        comment: 'Path to skill icon image like /assets/skills/xxx.webp',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove image column from skill_definitions table
    await queryRunner.dropColumn('skill_definitions', 'image');
  }
}
