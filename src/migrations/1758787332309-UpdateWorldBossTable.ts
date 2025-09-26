import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class UpdateWorldBossTable1758787332309 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new enum value to status
    await queryRunner.query(`
      ALTER TYPE "world_boss_status_enum" ADD VALUE 'scheduled';
    `);

    // Add displayMode enum
    await queryRunner.query(`
      CREATE TYPE "world_boss_displaymode_enum" AS ENUM('health_bar', 'damage_bar');
    `);

    // Add new columns
    await queryRunner.addColumns('world_boss', [
      new TableColumn({
        name: 'displayMode',
        type: 'enum',
        enum: ['health_bar', 'damage_bar'],
        default: "'damage_bar'",
      }),
      new TableColumn({
        name: 'scheduledStartTime',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'damagePhases',
        type: 'jsonb',
        default:
          '\'{"phase1Threshold": 1000000, "phase2Threshold": 2000000, "phase3Threshold": 3000000, "currentPhase": 1, "totalDamageReceived": 0}\'',
      }),
      new TableColumn({
        name: 'scheduleId',
        type: 'integer',
        isNullable: true,
      }),
      new TableColumn({
        name: 'maxCombatTurns',
        type: 'integer',
        default: 50,
      }),
    ]);

    // Update rewards column structure
    await queryRunner.query(`
      UPDATE world_boss 
      SET rewards = jsonb_build_object(
        'individual', jsonb_build_object(
          'top1', jsonb_build_object('gold', (rewards->>'gold')::integer, 'experience', (rewards->>'experience')::integer, 'items', rewards->'items'),
          'top2', jsonb_build_object('gold', ((rewards->>'gold')::integer * 0.7)::integer, 'experience', ((rewards->>'experience')::integer * 0.7)::integer, 'items', '[]'::jsonb),
          'top3', jsonb_build_object('gold', ((rewards->>'gold')::integer * 0.5)::integer, 'experience', ((rewards->>'experience')::integer * 0.5)::integer, 'items', '[]'::jsonb),
          'top4to10', jsonb_build_object('gold', ((rewards->>'gold')::integer * 0.3)::integer, 'experience', ((rewards->>'experience')::integer * 0.3)::integer, 'items', '[]'::jsonb),
          'top11to30', jsonb_build_object('gold', ((rewards->>'gold')::integer * 0.1)::integer, 'experience', ((rewards->>'experience')::integer * 0.1)::integer, 'items', '[]'::jsonb)
        ),
        'guild', jsonb_build_object(
          'top1', jsonb_build_object('gold', ((rewards->>'gold')::integer * 2)::integer, 'experience', ((rewards->>'experience')::integer * 2)::integer, 'items', '[]'::jsonb),
          'top2to5', jsonb_build_object('gold', (rewards->>'gold')::integer, 'experience', (rewards->>'experience')::integer, 'items', '[]'::jsonb),
          'top6to10', jsonb_build_object('gold', ((rewards->>'gold')::integer * 0.5)::integer, 'experience', ((rewards->>'experience')::integer * 0.5)::integer, 'items', '[]'::jsonb)
        )
      )
      WHERE rewards IS NOT NULL;
    `);

    // Add foreign key constraint
    await queryRunner.createForeignKey(
      'world_boss',
      new TableForeignKey({
        columnNames: ['scheduleId'],
        referencedTableName: 'boss_schedule',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key
    const table = await queryRunner.getTable('world_boss');
    const foreignKey = table!.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('scheduleId') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('world_boss', foreignKey);
    }

    // Remove columns
    await queryRunner.dropColumns('world_boss', [
      'displayMode',
      'scheduledStartTime',
      'damagePhases',
      'scheduleId',
      'maxCombatTurns',
    ]);

    // Drop enum
    await queryRunner.query(`DROP TYPE "world_boss_displaymode_enum";`);

    // Note: Cannot easily remove enum value from existing enum type
    // This would require recreating the enum type which is complex
  }
}
