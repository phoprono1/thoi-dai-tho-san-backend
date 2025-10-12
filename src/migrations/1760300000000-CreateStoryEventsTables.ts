import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStoryEventsTables1760300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "story_events" (
        "id" SERIAL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "slug" TEXT UNIQUE,
        "storyType" VARCHAR(32) DEFAULT 'event',
        "descriptionHtml" TEXT,
        "contentHtml" TEXT,
        "eventStart" TIMESTAMP WITH TIME ZONE,
        "eventEnd" TIMESTAMP WITH TIME ZONE,
        "visibilityMode" VARCHAR(32) DEFAULT 'visible',
        "participationRequired" boolean NOT NULL DEFAULT false,
        "globalEnabled" boolean NOT NULL DEFAULT false,
        "globalTarget" bigint,
        "rewardConfig" jsonb,
        "createdBy" integer,
        "isActive" boolean DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "story_event_global" (
        "id" SERIAL PRIMARY KEY,
        "storyEventId" integer NOT NULL REFERENCES story_events(id) ON DELETE CASCADE,
        "totalDungeonClears" bigint DEFAULT 0,
        "totalEnemyKills" bigint DEFAULT 0,
        "totalItemsContributed" bigint DEFAULT 0,
        "lastUpdated" TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "story_event_user_contrib" (
        "id" SERIAL PRIMARY KEY,
        "storyEventId" integer NOT NULL REFERENCES story_events(id) ON DELETE CASCADE,
        "userId" integer NOT NULL,
        "dungeonClears" bigint DEFAULT 0,
        "enemyKills" bigint DEFAULT 0,
        "itemsContributed" bigint DEFAULT 0,
        "totalScore" bigint DEFAULT 0,
        "lastContributionAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_story_event_user_unique" ON "story_event_user_contrib" ("storyEventId", "userId");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "story_event_combat_tracking" (
        "id" SERIAL PRIMARY KEY,
        "storyEventId" integer NOT NULL REFERENCES story_events(id) ON DELETE CASCADE,
        "userId" integer NOT NULL,
        "combatResultId" integer NOT NULL,
        "processedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_story_event_combat_unique" ON "story_event_combat_tracking" ("storyEventId", "userId", "combatResultId");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "story_event_attachments" (
        "id" SERIAL PRIMARY KEY,
        "storyEventId" integer REFERENCES story_events(id) ON DELETE CASCADE,
        "fileUrl" TEXT,
        "mimeType" TEXT,
        "caption" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "story_event_attachments";`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_story_event_combat_unique";`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "story_event_combat_tracking";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_story_event_user_unique";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "story_event_user_contrib";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "story_event_global";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "story_events";`);
  }
}
