import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexesForUserPets1733290000000 implements MigrationInterface {
  name = 'AddIndexesForUserPets1733290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add composite index for userId + isActive for fast active pet lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_pets_userId_isActive" 
      ON "user_pets" ("userId", "isActive") 
      WHERE "isActive" = true;
    `);

    // Add composite index for userId + level + obtainedAt for sorting
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_pets_userId_level_obtained" 
      ON "user_pets" ("userId", "level" DESC, "obtainedAt" DESC);
    `);

    // Add index on userId alone for general queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_pets_userId" 
      ON "user_pets" ("userId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_pets_userId_isActive";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_pets_userId_level_obtained";`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_pets_userId";`);
  }
}
