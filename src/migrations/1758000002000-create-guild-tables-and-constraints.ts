import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGuildTablesAndConstraints1758000002000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create guilds table if missing
    const hasGuilds = await queryRunner.hasTable('guilds');
    if (!hasGuilds) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "guilds" (
          "id" SERIAL PRIMARY KEY,
          "name" varchar(255) UNIQUE NOT NULL,
          "description" text,
          "level" integer DEFAULT 1,
          "experience" integer DEFAULT 0,
          "goldFund" integer DEFAULT 0,
          "maxMembers" integer DEFAULT 0,
          "currentMembers" integer DEFAULT 0,
          "status" varchar(50) DEFAULT 'ACTIVE',
          "leaderId" integer,
          "announcement" text,
          "settings" json,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
        );
      `);
    }

    // Create guild_members table if missing
    const hasMembers = await queryRunner.hasTable('guild_members');
    if (!hasMembers) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "guild_members" (
          "id" SERIAL PRIMARY KEY,
          "guildId" integer NOT NULL,
          "userId" integer NOT NULL,
          "role" varchar(50) DEFAULT 'MEMBER',
          "contributionGold" integer DEFAULT 0,
          "honorPoints" integer DEFAULT 0,
          "weeklyContribution" integer DEFAULT 0,
          "isOnline" boolean DEFAULT false,
          "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
          "lastActiveAt" TIMESTAMP
        );
      `);
    }

    // Create guild_events table if missing
    const hasEvents = await queryRunner.hasTable('guild_events');
    if (!hasEvents) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "guild_events" (
          "id" SERIAL PRIMARY KEY,
          "guildId" integer NOT NULL,
          "eventType" varchar(50),
          "status" varchar(50) DEFAULT 'PENDING',
          "title" varchar(255),
          "description" text,
          "participants" json,
          "eventData" json,
          "opponentGuildId" integer,
          "scheduledAt" TIMESTAMP,
          "completedAt" TIMESTAMP,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
        );
      `);
    }

    // Add FK constraints (if not present)
    // guild_members.guildId -> guilds.id
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'guild_members'
        ) THEN
          ALTER TABLE "guild_members" ADD CONSTRAINT fk_guild_members_guild FOREIGN KEY ("guildId") REFERENCES "guilds"(id) ON DELETE CASCADE;
        END IF;
      END$$;
    `);

    // guild_events.guildId -> guilds.id
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'guild_events'
        ) THEN
          ALTER TABLE "guild_events" ADD CONSTRAINT fk_guild_events_guild FOREIGN KEY ("guildId") REFERENCES "guilds"(id) ON DELETE CASCADE;
        END IF;
      END$$;
    `);

    // Add unique constraint on (guildId, userId)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          WHERE tc.constraint_type = 'UNIQUE' AND tc.table_name = 'guild_members' AND EXISTS (
            SELECT 1 FROM information_schema.key_column_usage kcu
            WHERE kcu.table_name = 'guild_members' AND kcu.column_name IN ('guildId','userId')
          )
        ) THEN
          ALTER TABLE "guild_members" ADD CONSTRAINT uq_guild_members_guild_user UNIQUE ("guildId","userId");
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove unique constraint if present
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "guild_members" DROP CONSTRAINT IF EXISTS uq_guild_members_guild_user;
    `);

    // Remove FK constraints
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "guild_events" DROP CONSTRAINT IF EXISTS fk_guild_events_guild;
      ALTER TABLE IF EXISTS "guild_members" DROP CONSTRAINT IF EXISTS fk_guild_members_guild;
    `);

    // Drop tables only if they were created by this migration (safe approach: keep them)
    // We will not drop tables on down to avoid losing data.
  }
}
