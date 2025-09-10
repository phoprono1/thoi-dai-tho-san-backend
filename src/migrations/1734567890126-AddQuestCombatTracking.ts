import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddQuestCombatTracking1734567890126 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'quest_combat_tracking',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'userId',
            type: 'int',
          },
          {
            name: 'questId',
            type: 'int',
          },
          {
            name: 'combatResultId',
            type: 'int',
          },
          {
            name: 'combatCompletedAt',
            type: 'timestamp',
          },
          {
            name: 'questProgressUpdated',
            type: 'boolean',
            default: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('quest_combat_tracking');
  }
}
