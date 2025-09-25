import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDailyLoginConfigs1758787332306
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "daily_login_config" (
        "id" SERIAL PRIMARY KEY,
        "year" integer NOT NULL,
        "month" integer NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_daily_login_config_year_month" ON "daily_login_config" ("year", "month");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_login_config";`);
  }
}
