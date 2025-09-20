import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixGuildTable1758366993012 implements MigrationInterface {
  name = 'FixGuildTable1758366993012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "settings"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "experience"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "goldFund"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "maxMembers"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "currentMembers"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "status"`);
    // Ensure the enum type exists before re-adding columns that depend on it.
    await queryRunner.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'guild_status_enum') THEN
        CREATE TYPE "public"."guild_status_enum" AS ENUM('ACTIVE','DISBANDED');
      END IF;
    END$$;`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "announcement"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "funds"`);
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "funds" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "description" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "experience" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "goldFund" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "maxMembers" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "currentMembers" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "status" "public"."guild_status_enum" NOT NULL DEFAULT 'ACTIVE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "announcement" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "guild" ADD "settings" json`);
    await queryRunner.query(
      `ALTER TABLE "guild" DROP CONSTRAINT "FK_593ab5a6b469192870d4ca8d1b3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" DROP CONSTRAINT "UQ_2ca3d32eea4c6607919f4774bf5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ALTER COLUMN "leaderId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD CONSTRAINT "FK_593ab5a6b469192870d4ca8d1b3" FOREIGN KEY ("leaderId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guild" DROP CONSTRAINT "FK_593ab5a6b469192870d4ca8d1b3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ALTER COLUMN "leaderId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD CONSTRAINT "UQ_2ca3d32eea4c6607919f4774bf5" UNIQUE ("name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD CONSTRAINT "FK_593ab5a6b469192870d4ca8d1b3" FOREIGN KEY ("leaderId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "settings"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "announcement"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "currentMembers"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "maxMembers"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "goldFund"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "experience"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP COLUMN "funds"`);
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "funds" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "description" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "announcement" character varying`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."guild_status_enum" AS ENUM('ACTIVE', 'DISBANDED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "status" "public"."guild_status_enum" NOT NULL DEFAULT 'ACTIVE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "currentMembers" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "maxMembers" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "goldFund" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "guild" ADD "experience" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`ALTER TABLE "guild" ADD "settings" json`);
  }
}
