import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSecurityFieldsToUser1759720356505
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add security-related columns to user table
    await queryRunner.query(`
            ALTER TABLE "user" 
            ADD COLUMN IF NOT EXISTS "registrationIp" VARCHAR,
            ADD COLUMN IF NOT EXISTS "lastLoginIp" VARCHAR,
            ADD COLUMN IF NOT EXISTS "lastLoginDate" TIMESTAMP,
            ADD COLUMN IF NOT EXISTS "deviceFingerprints" JSONB,
            ADD COLUMN IF NOT EXISTS "isSuspicious" BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS "suspiciousScore" INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "tempBanUntil" TIMESTAMP,
            ADD COLUMN IF NOT EXISTS "banReason" VARCHAR,
            ADD COLUMN IF NOT EXISTS "registrationSource" VARCHAR,
            ADD COLUMN IF NOT EXISTS "accountFlags" JSONB
        `);

    // Create indexes for performance
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_USER_REGISTRATION_IP" ON "user"("registrationIp")
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_USER_LAST_LOGIN_IP" ON "user"("lastLoginIp")
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_USER_SUSPICIOUS" ON "user"("isSuspicious")
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_USER_TEMP_BAN" ON "user"("tempBanUntil")
        `);

    console.log('✅ Security fields added to user table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_USER_TEMP_BAN"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_USER_SUSPICIOUS"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_USER_LAST_LOGIN_IP"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_USER_REGISTRATION_IP"`);

    // Drop columns
    await queryRunner.query(`
            ALTER TABLE "user" 
            DROP COLUMN IF EXISTS "accountFlags",
            DROP COLUMN IF EXISTS "registrationSource",
            DROP COLUMN IF EXISTS "banReason",
            DROP COLUMN IF EXISTS "tempBanUntil",
            DROP COLUMN IF EXISTS "suspiciousScore",
            DROP COLUMN IF EXISTS "isSuspicious",
            DROP COLUMN IF EXISTS "deviceFingerprints",
            DROP COLUMN IF EXISTS "lastLoginDate",
            DROP COLUMN IF EXISTS "lastLoginIp",
            DROP COLUMN IF EXISTS "registrationIp"
        `);

    console.log('✅ Security fields removed from user table');
  }
}
