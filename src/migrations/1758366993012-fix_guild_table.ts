import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixGuildTable1758366993012 implements MigrationInterface {
  name = 'FixGuildTable1758366993012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old columns if they exist (make migration tolerant to schema differences)
    await queryRunner.query(`DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guild' AND column_name='settings') THEN
        ALTER TABLE "guild" DROP COLUMN "settings";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guild' AND column_name='experience') THEN
        ALTER TABLE "guild" DROP COLUMN "experience";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guild' AND column_name='goldFund') THEN
        ALTER TABLE "guild" DROP COLUMN "goldFund";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guild' AND column_name='maxMembers') THEN
        ALTER TABLE "guild" DROP COLUMN "maxMembers";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guild' AND column_name='currentMembers') THEN
        ALTER TABLE "guild" DROP COLUMN "currentMembers";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guild' AND column_name='status') THEN
        ALTER TABLE "guild" DROP COLUMN "status";
      END IF;
    END$$;`);
    // Ensure the enum type exists before re-adding columns that depend on it.
    await queryRunner.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'guild_status_enum') THEN
        CREATE TYPE "public"."guild_status_enum" AS ENUM('ACTIVE','DISBANDED');
      END IF;
    END$$;`);
    await queryRunner.query(`DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guild' AND column_name='announcement') THEN
        ALTER TABLE "guild" DROP COLUMN "announcement";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guild' AND column_name='description') THEN
        ALTER TABLE "guild" DROP COLUMN "description";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guild' AND column_name='funds') THEN
        ALTER TABLE "guild" DROP COLUMN "funds";
      END IF;
    END$$;`);
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
