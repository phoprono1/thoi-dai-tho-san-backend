import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGlobalGuildBuffSystem1758787332313 implements MigrationInterface {
  name = 'AddGlobalGuildBuffSystem1758787332313';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create global_guild_buffs table
    await queryRunner.query(`
      CREATE TABLE "global_guild_buffs" (
        "id" SERIAL NOT NULL,
        "guildLevel" integer NOT NULL UNIQUE,
        "statBuffs" jsonb NOT NULL,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_global_guild_buffs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_global_guild_buffs_level" UNIQUE ("guildLevel")
      )
    `);

    // Insert default global guild buff configurations
    await queryRunner.query(`
      INSERT INTO "global_guild_buffs" ("guildLevel", "statBuffs", "description", "isActive") VALUES
      (1, '{"strength": 5, "intelligence": 5, "dexterity": 5, "vitality": 5, "luck": 5}', 'Guild Level 1 - Basic member benefits', true),
      (2, '{"strength": 10, "intelligence": 10, "dexterity": 10, "vitality": 10, "luck": 10}', 'Guild Level 2 - Enhanced member benefits', true),
      (3, '{"strength": 15, "intelligence": 15, "dexterity": 15, "vitality": 15, "luck": 15}', 'Guild Level 3 - Advanced member benefits', true),
      (4, '{"strength": 25, "intelligence": 25, "dexterity": 25, "vitality": 25, "luck": 25}', 'Guild Level 4 - Expert member benefits', true),
      (5, '{"strength": 40, "intelligence": 40, "dexterity": 40, "vitality": 40, "luck": 40}', 'Guild Level 5 - Master member benefits', true),
      (6, '{"strength": 60, "intelligence": 60, "dexterity": 60, "vitality": 60, "luck": 60}', 'Guild Level 6 - Elite member benefits', true),
      (7, '{"strength": 85, "intelligence": 85, "dexterity": 85, "vitality": 85, "luck": 85}', 'Guild Level 7 - Champion member benefits', true),
      (8, '{"strength": 115, "intelligence": 115, "dexterity": 115, "vitality": 115, "luck": 115}', 'Guild Level 8 - Legendary member benefits', true),
      (9, '{"strength": 150, "intelligence": 150, "dexterity": 150, "vitality": 150, "luck": 150}', 'Guild Level 9 - Mythical member benefits', true),
      (10, '{"strength": 200, "intelligence": 200, "dexterity": 200, "vitality": 200, "luck": 200}', 'Guild Level 10 - Divine member benefits', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the table
    await queryRunner.query(`DROP TABLE "global_guild_buffs"`);
  }
}
