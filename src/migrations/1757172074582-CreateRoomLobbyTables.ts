import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoomLobbyTables1757172074582 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create room_lobby table
    await queryRunner.query(`
            CREATE TABLE "room_lobby" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "hostId" integer NOT NULL,
                "dungeonId" integer NOT NULL,
                "status" character varying NOT NULL DEFAULT 'waiting',
                "minPlayers" integer NOT NULL DEFAULT 1,
                "maxPlayers" integer NOT NULL DEFAULT 4,
                "isPrivate" boolean NOT NULL DEFAULT false,
                "password" character varying,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_room_lobby" PRIMARY KEY ("id")
            )
        `);

    // Create room_player table
    await queryRunner.query(`
            CREATE TABLE "room_player" (
                "id" SERIAL NOT NULL,
                "roomId" integer NOT NULL,
                "playerId" integer NOT NULL,
                "status" character varying NOT NULL DEFAULT 'joined',
                "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "leftAt" TIMESTAMP,
                CONSTRAINT "PK_room_player" PRIMARY KEY ("id")
            )
        `);

    // Add foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "room_lobby"
            ADD CONSTRAINT "FK_room_lobby_host" FOREIGN KEY ("hostId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "room_lobby"
            ADD CONSTRAINT "FK_room_lobby_dungeon" FOREIGN KEY ("dungeonId") REFERENCES "dungeon"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "room_player"
            ADD CONSTRAINT "FK_room_player_room" FOREIGN KEY ("roomId") REFERENCES "room_lobby"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "room_player"
            ADD CONSTRAINT "FK_room_player_player" FOREIGN KEY ("playerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    // Add indexes for better performance
    await queryRunner.query(`
            CREATE INDEX "IDX_room_lobby_status" ON "room_lobby" ("status")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_room_lobby_host" ON "room_lobby" ("hostId")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_room_player_room" ON "room_player" ("roomId")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_room_player_player" ON "room_player" ("playerId")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_room_player_player"`);
    await queryRunner.query(`DROP INDEX "IDX_room_player_room"`);
    await queryRunner.query(`DROP INDEX "IDX_room_lobby_host"`);
    await queryRunner.query(`DROP INDEX "IDX_room_lobby_status"`);

    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "room_player" DROP CONSTRAINT "FK_room_player_player"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_player" DROP CONSTRAINT "FK_room_player_room"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_lobby" DROP CONSTRAINT "FK_room_lobby_dungeon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_lobby" DROP CONSTRAINT "FK_room_lobby_host"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE "room_player"`);
    await queryRunner.query(`DROP TABLE "room_lobby"`);
  }
}
