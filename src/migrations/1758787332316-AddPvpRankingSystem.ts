import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPvpRankingSystem1758787332316 implements MigrationInterface {
  name = 'AddPvpRankingSystem1758787332316';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create PvP Seasons table
    await queryRunner.query(`
      CREATE TABLE "pvp_seasons" (
        "id" SERIAL NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" text,
        "startDate" TIMESTAMP NOT NULL,
        "endDate" TIMESTAMP NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "rewards" json,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pvp_seasons" PRIMARY KEY ("id")
      )
    `);

    // Create PvP Rankings table
    await queryRunner.query(`
      CREATE TABLE "pvp_rankings" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "seasonId" integer NOT NULL,
        "hunterPoints" integer NOT NULL DEFAULT 1200,
        "currentRank" character varying NOT NULL DEFAULT 'APPRENTICE',
        "wins" integer NOT NULL DEFAULT 0,
        "losses" integer NOT NULL DEFAULT 0,
        "totalMatches" integer NOT NULL DEFAULT 0,
        "winStreak" integer NOT NULL DEFAULT 0,
        "bestWinStreak" integer NOT NULL DEFAULT 0,
        "highestPoints" integer NOT NULL DEFAULT 1200,
        "lastMatchAt" TIMESTAMP,
        "lastOpponentRefreshAt" TIMESTAMP,
        "hasClaimedDailyReward" boolean NOT NULL DEFAULT false,
        "lastDailyRewardDate" date,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pvp_rankings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pvp_rankings_user_season" UNIQUE ("userId", "seasonId")
      )
    `);

    // Create PvP Matches New table
    await queryRunner.query(`
      CREATE TABLE "pvp_matches_new" (
        "id" SERIAL NOT NULL,
        "challengerId" integer NOT NULL,
        "defenderId" integer NOT NULL,
        "seasonId" integer NOT NULL,
        "winnerId" integer,
        "challengerPointsBefore" integer NOT NULL,
        "defenderPointsBefore" integer NOT NULL,
        "challengerPointsAfter" integer NOT NULL,
        "defenderPointsAfter" integer NOT NULL,
        "pointsChange" integer NOT NULL,
        "combatResult" json,
        "combatSeed" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pvp_matches_new" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints (check if users table exists first)
    const usersTableExists = await queryRunner.hasTable('users');
    if (usersTableExists) {
      await queryRunner.query(`
        ALTER TABLE "pvp_rankings" 
        ADD CONSTRAINT "FK_pvp_rankings_userId" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      `);
    }

    await queryRunner.query(`
      ALTER TABLE "pvp_rankings" 
      ADD CONSTRAINT "FK_pvp_rankings_seasonId" 
      FOREIGN KEY ("seasonId") REFERENCES "pvp_seasons"("id") ON DELETE CASCADE
    `);

    if (usersTableExists) {
      await queryRunner.query(`
        ALTER TABLE "pvp_matches_new" 
        ADD CONSTRAINT "FK_pvp_matches_new_challengerId" 
        FOREIGN KEY ("challengerId") REFERENCES "users"("id") ON DELETE CASCADE
      `);

      await queryRunner.query(`
        ALTER TABLE "pvp_matches_new" 
        ADD CONSTRAINT "FK_pvp_matches_new_defenderId" 
        FOREIGN KEY ("defenderId") REFERENCES "users"("id") ON DELETE CASCADE
      `);
    }

    await queryRunner.query(`
      ALTER TABLE "pvp_matches_new" 
      ADD CONSTRAINT "FK_pvp_matches_new_seasonId" 
      FOREIGN KEY ("seasonId") REFERENCES "pvp_seasons"("id") ON DELETE CASCADE
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "IDX_pvp_rankings_season_points" ON "pvp_rankings" ("seasonId", "hunterPoints" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pvp_matches_new_participants" ON "pvp_matches_new" ("challengerId", "defenderId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pvp_matches_new_season_date" ON "pvp_matches_new" ("seasonId", "createdAt" DESC)
    `);

    // Insert default season
    await queryRunner.query(`
      INSERT INTO "pvp_seasons" ("name", "description", "startDate", "endDate", "isActive", "rewards")
      VALUES (
        'Mùa Giải Khai Mạc',
        'Mùa giải PvP đầu tiên của Thời Đại Thợ Săn',
        NOW(),
        NOW() + INTERVAL '7 days',
        true,
        '{
          "daily": {
            "APPRENTICE": {"gold": 100, "experience": 50},
            "AMATEUR": {"gold": 200, "experience": 100},
            "PROFESSIONAL": {"gold": 300, "experience": 150},
            "ELITE": {"gold": 500, "experience": 250},
            "EPIC": {"gold": 750, "experience": 375},
            "LEGENDARY": {"gold": 1000, "experience": 500},
            "MYTHICAL": {"gold": 1500, "experience": 750},
            "DIVINE": {"gold": 2000, "experience": 1000}
          },
          "seasonal": {
            "top1": {"gold": 50000, "experience": 25000},
            "top2to3": {"gold": 25000, "experience": 12500},
            "top4to10": {"gold": 10000, "experience": 5000}
          }
        }'::json
      )
    `);

    // Add check constraint for hunter rank enum
    await queryRunner.query(`
      ALTER TABLE "pvp_rankings" 
      ADD CONSTRAINT "CHK_pvp_rankings_currentRank" 
      CHECK ("currentRank" IN ('APPRENTICE', 'AMATEUR', 'PROFESSIONAL', 'ELITE', 'EPIC', 'LEGENDARY', 'MYTHICAL', 'DIVINE'))
    `);

    console.log('✅ PvP Ranking System migration completed successfully!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints first
    await queryRunner.query(
      `ALTER TABLE "pvp_matches_new" DROP CONSTRAINT "FK_pvp_matches_new_seasonId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pvp_matches_new" DROP CONSTRAINT "FK_pvp_matches_new_defenderId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pvp_matches_new" DROP CONSTRAINT "FK_pvp_matches_new_challengerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pvp_rankings" DROP CONSTRAINT "FK_pvp_rankings_seasonId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pvp_rankings" DROP CONSTRAINT "FK_pvp_rankings_userId"`,
    );

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_pvp_matches_new_season_date"`);
    await queryRunner.query(`DROP INDEX "IDX_pvp_matches_new_participants"`);
    await queryRunner.query(`DROP INDEX "IDX_pvp_rankings_season_points"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "pvp_matches_new"`);
    await queryRunner.query(`DROP TABLE "pvp_rankings"`);
    await queryRunner.query(`DROP TABLE "pvp_seasons"`);

    console.log('✅ PvP Ranking System migration rolled back successfully!');
  }
}
