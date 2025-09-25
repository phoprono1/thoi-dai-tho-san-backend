import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDailyLoginRecords1695630000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "daily_login_records" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "loginDate" date NOT NULL,
        "streakCount" integer NOT NULL DEFAULT 0,
        "claimed" boolean NOT NULL DEFAULT false,
        "rewards" jsonb,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_daily_login_records_user_date" ON "daily_login_records" ("userId", "loginDate");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_daily_login_records_user_streak" ON "daily_login_records" ("userId", "streakCount");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_login_records";`);
  }
}
