import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGiftcodeTables1695630000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "giftcode" (
        "id" SERIAL PRIMARY KEY,
        "code" varchar(255) NOT NULL UNIQUE,
        "rewards" jsonb,
        "usesAllowed" integer,
        "usesRemaining" integer,
        "expiresAt" timestamp,
        "isActive" boolean DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "giftcode_usage" (
        "id" SERIAL PRIMARY KEY,
        "giftcodeId" integer NOT NULL,
        "userId" integer NOT NULL,
        "redeemedAt" TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_giftcode_code" ON "giftcode" ("code");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_giftcode_usage_gift_user" ON "giftcode_usage" ("giftcodeId", "userId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "giftcode_usage";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "giftcode";`);
  }
}
