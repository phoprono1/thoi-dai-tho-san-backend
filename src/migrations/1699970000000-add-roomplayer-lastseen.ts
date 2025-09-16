import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomplayerLastseen1699970000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add nullable lastSeen column
    await queryRunner.query(
      `ALTER TABLE "room_player" ADD COLUMN IF NOT EXISTS "lastSeen" TIMESTAMP`,
    );

    // Backfill existing rows: set lastSeen to NOW() to avoid immediately
    // treating long-lived existing records as stale. This is the safer rollout
    // path; if you prefer to consider past inactivity, change this to use
    // joinedAt instead.
    await queryRunner.query(
      `UPDATE "room_player" SET "lastSeen" = NOW() WHERE "lastSeen" IS NULL`,
    );

    // Add index to support cleanup queries
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_room_player_lastSeen" ON "room_player" ("lastSeen")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_room_player_lastSeen"`);
    await queryRunner.query(
      `ALTER TABLE "room_player" DROP COLUMN IF EXISTS "lastSeen"`,
    );
  }
}
