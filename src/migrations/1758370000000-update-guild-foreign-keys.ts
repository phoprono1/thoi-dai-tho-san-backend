import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateGuildForeignKeys1758370000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Đơn giản: Drop và recreate FK constraints để reference đúng table "guild"

    // 1. Drop old FK constraint FK_2c6d1fa8790304f7488cd929596 (guild_members -> guilds)
    await queryRunner.query(`
      ALTER TABLE "guild_members" DROP CONSTRAINT IF EXISTS "FK_2c6d1fa8790304f7488cd929596"
    `);

    // 2. Drop old FK constraints nếu tồn tại
    await queryRunner.query(`
      ALTER TABLE "guild_members" DROP CONSTRAINT IF EXISTS "fk_guild_members_guild"
    `);

    await queryRunner.query(`
      ALTER TABLE "guild_events" DROP CONSTRAINT IF EXISTS "fk_guild_events_guild"
    `);

    // 3. Thêm lại FK constraints với reference đúng table "guild"
    await queryRunner.query(`
      ALTER TABLE "guild_members" 
      ADD CONSTRAINT "FK_2c6d1fa8790304f7488cd929596" 
      FOREIGN KEY ("guildId") REFERENCES "guild"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "guild_events" 
      ADD CONSTRAINT "FK_guild_events_guild" 
      FOREIGN KEY ("guildId") REFERENCES "guild"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert changes
    await queryRunner.query(`
      ALTER TABLE "guild_members" DROP CONSTRAINT IF EXISTS "FK_2c6d1fa8790304f7488cd929596"
    `);

    await queryRunner.query(`
      ALTER TABLE "guild_events" DROP CONSTRAINT IF EXISTS "FK_guild_events_guild"
    `);

    // Note: We don't re-add old FK to "guilds" table since it may not exist
  }
}
