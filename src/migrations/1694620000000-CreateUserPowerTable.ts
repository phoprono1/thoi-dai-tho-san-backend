import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserPowerTable1694620000000 implements MigrationInterface {
  name = 'CreateUserPowerTable1694620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_power" (
        "id" serial PRIMARY KEY,
        "userId" integer NOT NULL UNIQUE,
        "combatPower" double precision NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_power_combat" ON "user_power" ("combatPower" DESC);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_power_combat";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_power";`);
  }
}
