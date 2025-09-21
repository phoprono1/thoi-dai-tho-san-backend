import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddRequirementsAndPendingAdvancements1759000001000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE character_class_advancements ADD COLUMN IF NOT EXISTS requirements jsonb`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'pending_advancements',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'userId', type: 'integer', isNullable: false },
          { name: 'options', type: 'jsonb', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            isNullable: false,
            default: `'available'`,
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

    await queryRunner.query(
      `ALTER TABLE pending_advancements ADD CONSTRAINT fk_pending_user FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('pending_advancements', true);
    await queryRunner.query(
      `ALTER TABLE character_class_advancements DROP COLUMN IF EXISTS requirements`,
    );
  }
}
