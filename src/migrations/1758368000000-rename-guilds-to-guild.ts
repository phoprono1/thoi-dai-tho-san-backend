import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameGuildsToGuild1758368000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // If the code expects table "guild" but the DB has "guilds", rename it.
    const hasGuildTable = await queryRunner.hasTable('guild');
    const hasGuildsTable = await queryRunner.hasTable('guilds');

    if (!hasGuildTable && hasGuildsTable) {
      await queryRunner.query(`ALTER TABLE "guilds" RENAME TO "guild";`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert rename if necessary
    const hasGuildTable = await queryRunner.hasTable('guild');
    const hasGuildsTable = await queryRunner.hasTable('guilds');

    if (hasGuildTable && !hasGuildsTable) {
      await queryRunner.query(`ALTER TABLE "guild" RENAME TO "guilds";`);
    }
  }
}
