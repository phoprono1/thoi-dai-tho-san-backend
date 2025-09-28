import { MigrationInterface, QueryRunner } from "typeorm";

export class InsertGuildBuffsLevel11To201759038600000 implements MigrationInterface {
    name = 'InsertGuildBuffsLevel11To201759038600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Only insert global guild buffs for levels 11-20 
        // guild_buffs table is per-guild and gets populated when guilds are created
        await queryRunner.query(`
            INSERT INTO "global_guild_buffs" ("guildLevel", "statBuffs", "description", "isActive") VALUES
            (11, '{"strength": 260, "intelligence": 260, "dexterity": 260, "vitality": 260, "luck": 260}', 'Guild Level 11 - Transcendent member benefits', true),
            (12, '{"strength": 330, "intelligence": 330, "dexterity": 330, "vitality": 330, "luck": 330}', 'Guild Level 12 - Celestial member benefits', true),
            (13, '{"strength": 410, "intelligence": 410, "dexterity": 410, "vitality": 410, "luck": 410}', 'Guild Level 13 - Immortal member benefits', true),
            (14, '{"strength": 500, "intelligence": 500, "dexterity": 500, "vitality": 500, "luck": 500}', 'Guild Level 14 - Eternal member benefits', true),
            (15, '{"strength": 600, "intelligence": 600, "dexterity": 600, "vitality": 600, "luck": 600}', 'Guild Level 15 - Omnipotent member benefits', true),
            (16, '{"strength": 720, "intelligence": 720, "dexterity": 720, "vitality": 720, "luck": 720}', 'Guild Level 16 - Supreme member benefits', true),
            (17, '{"strength": 860, "intelligence": 860, "dexterity": 860, "vitality": 860, "luck": 860}', 'Guild Level 17 - Ultimate member benefits', true),
            (18, '{"strength": 1020, "intelligence": 1020, "dexterity": 1020, "vitality": 1020, "luck": 1020}', 'Guild Level 18 - Absolute member benefits', true),
            (19, '{"strength": 1200, "intelligence": 1200, "dexterity": 1200, "vitality": 1200, "luck": 1200}', 'Guild Level 19 - Infinite member benefits', true),
            (20, '{"strength": 1500, "intelligence": 1500, "dexterity": 1500, "vitality": 1500, "luck": 1500}', 'Guild Level 20 - Omniversal member benefits', true)
            ON CONFLICT ("guildLevel") DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove global guild buffs for levels 11-20
        await queryRunner.query(`DELETE FROM "global_guild_buffs" WHERE "guildLevel" BETWEEN 11 AND 20;`);
    }
}
