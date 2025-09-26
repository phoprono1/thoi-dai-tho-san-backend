import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateBossCombatCooldown1758787332308
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'boss_combat_cooldown',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'bossId',
            type: 'integer',
          },
          {
            name: 'userId',
            type: 'integer',
          },
          {
            name: 'lastCombatTime',
            type: 'timestamp',
          },
          {
            name: 'cooldownUntil',
            type: 'timestamp',
          },
          {
            name: 'cooldownSeconds',
            type: 'integer',
            default: 60,
          },
          {
            name: 'totalCombats',
            type: 'integer',
            default: 0,
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
        foreignKeys: [
          {
            columnNames: ['bossId'],
            referencedTableName: 'world_boss',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['userId'],
            referencedTableName: 'user',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_boss_combat_cooldown_bossId',
            columnNames: ['bossId'],
          },
          {
            name: 'IDX_boss_combat_cooldown_userId',
            columnNames: ['userId'],
          },
        ],
        uniques: [
          {
            name: 'UQ_boss_combat_cooldown_bossId_userId',
            columnNames: ['bossId', 'userId'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('boss_combat_cooldown');
  }
}
