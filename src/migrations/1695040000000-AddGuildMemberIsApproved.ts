import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddGuildMemberIsApproved1695040000000
  implements MigrationInterface
{
  name = 'AddGuildMemberIsApproved1695040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add column if it doesn't exist (idempotent)
    const hasColumn = await queryRunner.hasColumn(
      'guild_members',
      'isApproved',
    );
    if (!hasColumn) {
      await queryRunner.addColumn(
        'guild_members',
        new TableColumn({
          name: 'isApproved',
          type: 'boolean',
          isNullable: false,
          default: false,
        }),
      );
    }

    // Backfill existing members as approved (existing members should be considered active)
    await queryRunner.query(
      `UPDATE guild_members SET "isApproved" = true WHERE "joinedAt" IS NOT NULL OR role = 'LEADER'`,
    );

    // Add an index to make request lookups fast if it doesn't exist
    const table = await queryRunner.getTable('guild_members');
    const hasIndex = table?.indices.some(
      (idx) => idx.name === 'IDX_guild_members_isApproved',
    );
    if (!hasIndex) {
      await queryRunner.createIndex(
        'guild_members',
        new TableIndex({
          name: 'IDX_guild_members_isApproved',
          columnNames: ['isApproved'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('guild_members');
    const hasIndex = table?.indices.some(
      (idx) => idx.name === 'IDX_guild_members_isApproved',
    );
    if (hasIndex) {
      await queryRunner.dropIndex(
        'guild_members',
        'IDX_guild_members_isApproved',
      );
    }

    const hasColumn = await queryRunner.hasColumn(
      'guild_members',
      'isApproved',
    );
    if (hasColumn) {
      await queryRunner.dropColumn('guild_members', 'isApproved');
    }
  }
}
