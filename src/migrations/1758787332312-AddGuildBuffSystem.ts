import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGuildBuffSystem1758787332312 implements MigrationInterface {
  name = 'AddGuildBuffSystem1758787332312';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create guild_buffs table
    await queryRunner.query(`
      CREATE TABLE "guild_buffs" (
        "id" SERIAL NOT NULL,
        "guildId" integer NOT NULL,
        "guildLevel" integer NOT NULL,
        "statBuffs" jsonb NOT NULL,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guild_buffs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_guild_buffs_guild" FOREIGN KEY ("guildId") REFERENCES "guild"("id") ON DELETE CASCADE
      )
    `);

    // Create unique index for guildId + guildLevel
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_guild_buffs_guild_level" ON "guild_buffs" ("guildId", "guildLevel")
    `);

    // Insert default guild buff configurations for existing guilds (if any exist)
    // We'll create these via the service instead to avoid complex SQL
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the table and index
    await queryRunner.query(`DROP INDEX "IDX_guild_buffs_guild_level"`);
    await queryRunner.query(`DROP TABLE "guild_buffs"`);
  }
}
