import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGuildTables1757172074584 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create guilds table
    await queryRunner.query(`
            CREATE TABLE "guilds" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "description" text,
                "level" integer NOT NULL DEFAULT 1,
                "experience" integer NOT NULL DEFAULT 0,
                "goldFund" integer NOT NULL DEFAULT 0,
                "maxMembers" integer NOT NULL DEFAULT 20,
                "currentMembers" integer NOT NULL DEFAULT 0,
                "status" character varying NOT NULL DEFAULT 'ACTIVE',
                "leaderId" integer NOT NULL,
                "announcement" text,
                "settings" json,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_guilds" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_guilds_name" UNIQUE ("name")
            )
        `);

    // Create guild_members table
    await queryRunner.query(`
            CREATE TABLE "guild_members" (
                "id" SERIAL NOT NULL,
                "guildId" integer NOT NULL,
                "userId" integer NOT NULL,
                "role" character varying NOT NULL DEFAULT 'MEMBER',
                "contributionGold" integer NOT NULL DEFAULT 0,
                "honorPoints" integer NOT NULL DEFAULT 0,
                "weeklyContribution" integer NOT NULL DEFAULT 0,
                "isOnline" boolean NOT NULL DEFAULT false,
                "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "lastActiveAt" TIMESTAMP,
                CONSTRAINT "PK_guild_members" PRIMARY KEY ("id")
            )
        `);

    // Create guild_events table
    await queryRunner.query(`
            CREATE TABLE "guild_events" (
                "id" SERIAL NOT NULL,
                "guildId" integer NOT NULL,
                "eventType" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'PENDING',
                "title" character varying,
                "description" text,
                "participants" json,
                "eventData" json,
                "opponentGuildId" integer,
                "scheduledAt" TIMESTAMP,
                "completedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_guild_events" PRIMARY KEY ("id")
            )
        `);

    // Add foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "guilds"
            ADD CONSTRAINT "FK_guilds_leader" FOREIGN KEY ("leaderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "guild_members"
            ADD CONSTRAINT "FK_guild_members_guild" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "guild_members"
            ADD CONSTRAINT "FK_guild_members_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "guild_events"
            ADD CONSTRAINT "FK_guild_events_guild" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    // Add indexes for better performance
    await queryRunner.query(`
            CREATE INDEX "IDX_guilds_status" ON "guilds" ("status")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_guilds_level" ON "guilds" ("level")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_guilds_leader" ON "guilds" ("leaderId")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_guild_members_guild" ON "guild_members" ("guildId")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_guild_members_user" ON "guild_members" ("userId")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_guild_members_role" ON "guild_members" ("role")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_guild_events_guild" ON "guild_events" ("guildId")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_guild_events_type" ON "guild_events" ("eventType")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_guild_events_status" ON "guild_events" ("status")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_guild_events_status"`);
    await queryRunner.query(`DROP INDEX "IDX_guild_events_type"`);
    await queryRunner.query(`DROP INDEX "IDX_guild_events_guild"`);
    await queryRunner.query(`DROP INDEX "IDX_guild_members_role"`);
    await queryRunner.query(`DROP INDEX "IDX_guild_members_user"`);
    await queryRunner.query(`DROP INDEX "IDX_guild_members_guild"`);
    await queryRunner.query(`DROP INDEX "IDX_guilds_leader"`);
    await queryRunner.query(`DROP INDEX "IDX_guilds_level"`);
    await queryRunner.query(`DROP INDEX "IDX_guilds_status"`);

    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "guild_events" DROP CONSTRAINT "FK_guild_events_guild"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild_members" DROP CONSTRAINT "FK_guild_members_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild_members" DROP CONSTRAINT "FK_guild_members_guild"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guilds" DROP CONSTRAINT "FK_guilds_leader"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE "guild_events"`);
    await queryRunner.query(`DROP TABLE "guild_members"`);
    await queryRunner.query(`DROP TABLE "guilds"`);
  }
}
