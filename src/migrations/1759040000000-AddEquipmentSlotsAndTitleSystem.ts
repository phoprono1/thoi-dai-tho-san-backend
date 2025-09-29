import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEquipmentSlotsAndTitleSystem1759040000000
  implements MigrationInterface
{
  name = 'AddEquipmentSlotsAndTitleSystem1759040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create title table
    await queryRunner.query(`
            CREATE TABLE "title" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "description" text,
                "rarity" character varying NOT NULL DEFAULT 'common',
                "source" character varying NOT NULL DEFAULT 'achievement',
                "stats" json,
                "displayEffects" json,
                "requirements" json,
                "isActive" boolean NOT NULL DEFAULT true,
                "isHidden" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_title_id" PRIMARY KEY ("id")
            )
        `);

    // Create user_title table
    await queryRunner.query(`
            CREATE TABLE "user_title" (
                "id" SERIAL NOT NULL,
                "userId" integer NOT NULL,
                "titleId" integer NOT NULL,
                "isEquipped" boolean NOT NULL DEFAULT false,
                "unlockedAt" TIMESTAMP,
                "unlockSource" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_user_title_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_user_title_userId_titleId" UNIQUE ("userId", "titleId")
            )
        `);

    // Add foreign key constraints for user_title
    await queryRunner.query(`
            ALTER TABLE "user_title" 
            ADD CONSTRAINT "FK_user_title_userId" 
            FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "user_title" 
            ADD CONSTRAINT "FK_user_title_titleId" 
            FOREIGN KEY ("titleId") REFERENCES "title"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    // Create indexes for performance
    await queryRunner.query(
      `CREATE INDEX "IDX_user_title_userId" ON "user_title" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_title_titleId" ON "user_title" ("titleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_title_isEquipped" ON "user_title" ("isEquipped")`,
    );

    // Update item type enum to include new equipment slots
    await queryRunner.query(`
            ALTER TYPE "item_type_enum" ADD VALUE IF NOT EXISTS 'helmet'
        `);
    await queryRunner.query(`
            ALTER TYPE "item_type_enum" ADD VALUE IF NOT EXISTS 'gloves'
        `);
    await queryRunner.query(`
            ALTER TYPE "item_type_enum" ADD VALUE IF NOT EXISTS 'boots'
        `);

    // Insert default titles
    await queryRunner.query(`
            INSERT INTO "title" ("name", "description", "rarity", "source", "stats", "displayEffects", "requirements") VALUES
            ('Tân Thủ', 'Danh hiệu cho người mới bắt đầu', 'common', 'achievement', 
             '{"strength": 1, "intelligence": 1, "dexterity": 1, "vitality": 1, "luck": 1}',
             '{"color": "#8B5A2B", "prefix": "[Tân Thủ]"}',
             '{"level": 1}'),
            ('Thợ Săn Tập Sự', 'Danh hiệu PvP cơ bản', 'common', 'pvp_rank',
             '{"strength": 5, "dexterity": 5}',
             '{"color": "#4A5568", "prefix": "[Tập Sự]"}',
             '{"pvpRank": "APPRENTICE"}'),
            ('Huyền Thoại', 'Danh hiệu cho những thợ săn huyền thoại', 'legendary', 'pvp_rank',
             '{"strength": 50, "intelligence": 50, "dexterity": 50, "vitality": 50, "luck": 50}',
             '{"color": "#FFD700", "backgroundColor": "#FF6B35", "glow": true, "animation": "pulse", "prefix": "[Huyền Thoại]"}',
             '{"pvpRank": "LEGENDARY"}')
            ON CONFLICT DO NOTHING;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "user_title" DROP CONSTRAINT "FK_user_title_titleId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_title" DROP CONSTRAINT "FK_user_title_userId"`,
    );

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_user_title_isEquipped"`);
    await queryRunner.query(`DROP INDEX "IDX_user_title_titleId"`);
    await queryRunner.query(`DROP INDEX "IDX_user_title_userId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "user_title"`);
    await queryRunner.query(`DROP TABLE "title"`);

    // Note: Cannot remove enum values in PostgreSQL, they will remain but unused
  }
}
