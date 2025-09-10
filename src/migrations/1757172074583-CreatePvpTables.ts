import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePvpTables1757172074583 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create pvp_matches table
    await queryRunner.query(`
            CREATE TABLE "pvp_matches" (
                "id" SERIAL NOT NULL,
                "matchType" character varying NOT NULL DEFAULT 'ONE_VS_ONE',
                "status" character varying NOT NULL DEFAULT 'WAITING',
                "winnerTeam" character varying,
                "teamAScore" integer NOT NULL DEFAULT 0,
                "teamBScore" integer NOT NULL DEFAULT 0,
                "maxPlayersPerTeam" integer NOT NULL DEFAULT 1,
                "currentPlayersTeamA" integer NOT NULL DEFAULT 0,
                "currentPlayersTeamB" integer NOT NULL DEFAULT 0,
                "matchResult" json,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_pvp_matches" PRIMARY KEY ("id")
            )
        `);

    // Create pvp_players table
    await queryRunner.query(`
            CREATE TABLE "pvp_players" (
                "id" SERIAL NOT NULL,
                "userId" integer NOT NULL,
                "matchId" integer NOT NULL,
                "team" character varying NOT NULL,
                "damageDealt" integer NOT NULL DEFAULT 0,
                "damageTaken" integer NOT NULL DEFAULT 0,
                "kills" integer NOT NULL DEFAULT 0,
                "deaths" integer NOT NULL DEFAULT 0,
                "assists" integer NOT NULL DEFAULT 0,
                "isReady" boolean NOT NULL DEFAULT false,
                "playerStats" json,
                "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_pvp_players" PRIMARY KEY ("id")
            )
        `);

    // Add foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "pvp_players"
            ADD CONSTRAINT "FK_pvp_players_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "pvp_players"
            ADD CONSTRAINT "FK_pvp_players_match" FOREIGN KEY ("matchId") REFERENCES "pvp_matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    // Add indexes for better performance
    await queryRunner.query(`
            CREATE INDEX "IDX_pvp_matches_status" ON "pvp_matches" ("status")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_pvp_matches_type" ON "pvp_matches" ("matchType")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_pvp_players_user" ON "pvp_players" ("userId")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_pvp_players_match" ON "pvp_players" ("matchId")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_pvp_players_team" ON "pvp_players" ("team")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_pvp_players_team"`);
    await queryRunner.query(`DROP INDEX "IDX_pvp_players_match"`);
    await queryRunner.query(`DROP INDEX "IDX_pvp_players_user"`);
    await queryRunner.query(`DROP INDEX "IDX_pvp_matches_type"`);
    await queryRunner.query(`DROP INDEX "IDX_pvp_matches_status"`);

    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "pvp_players" DROP CONSTRAINT "FK_pvp_players_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pvp_players" DROP CONSTRAINT "FK_pvp_players_user"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE "pvp_players"`);
    await queryRunner.query(`DROP TABLE "pvp_matches"`);
  }
}
