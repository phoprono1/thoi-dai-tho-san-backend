import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPetAbilitiesColumns1759630679605 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add unlockedAbilities column (stores ability IDs as array)
    await queryRunner.query(`
            ALTER TABLE "user_pets" 
            ADD COLUMN "unlockedAbilities" text[] DEFAULT '{}'
        `);

    // Add abilityCooldowns column (stores ability cooldowns as JSON)
    await queryRunner.query(`
            ALTER TABLE "user_pets" 
            ADD COLUMN "abilityCooldowns" jsonb DEFAULT '{}'
        `);

    console.log(
      '✅ Added pet abilities columns: unlockedAbilities (text[]), abilityCooldowns (jsonb)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns
    await queryRunner.query(`
            ALTER TABLE "user_pets" 
            DROP COLUMN "abilityCooldowns"
        `);

    await queryRunner.query(`
            ALTER TABLE "user_pets" 
            DROP COLUMN "unlockedAbilities"
        `);

    console.log('✅ Rolled back pet abilities columns');
  }
}
