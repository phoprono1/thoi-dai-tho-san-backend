import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateBossSchedule1758787332307 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'boss_schedule',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'dayOfWeek',
            type: 'enum',
            enum: [
              'monday',
              'tuesday',
              'wednesday',
              'thursday',
              'friday',
              'saturday',
              'sunday',
            ],
          },
          {
            name: 'startTime',
            type: 'time',
          },
          {
            name: 'durationMinutes',
            type: 'integer',
            default: 120,
          },
          {
            name: 'bossTemplate',
            type: 'jsonb',
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'timezone',
            type: 'varchar',
            length: '50',
            default: "'Asia/Ho_Chi_Minh'",
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
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('boss_schedule');
  }
}
