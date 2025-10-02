import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrentManaToUserStats1760100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add currentMana field to user_stat table
    // NULL by default - will be initialized on first combat
    await queryRunner.query(`
            ALTER TABLE user_stat 
            ADD COLUMN "currentMana" INT DEFAULT NULL
        `);

    console.log('✅ Added currentMana column to user_stat table');
    console.log(
      'ℹ️  currentMana will be initialized to maxMana on first combat entry',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove currentMana field from user_stat
    await queryRunner.query(`
            ALTER TABLE user_stat 
            DROP COLUMN "currentMana"
        `);
  }
}
