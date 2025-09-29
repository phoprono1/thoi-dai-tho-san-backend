import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceCharacterClassSystem1759038700000
  implements MigrationInterface
{
  name = 'EnhanceCharacterClassSystem1759038700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add flexible metadata column to character_classes table
    await queryRunner.query(`
      ALTER TABLE "character_classes" 
      ADD COLUMN IF NOT EXISTS "metadata" jsonb
    `);

    // Keep existing class types as they are (no migration needed)
    console.log(
      'Keeping existing 10-class system with KNIGHT, TANK, HEALER...',
    );

    // Initialize basic metadata for existing classes (admin can customize later)
    console.log('Setting up flexible metadata for existing classes...');

    await queryRunner.query(`
      UPDATE "character_classes" 
      SET "metadata" = jsonb_build_object(
        'displayName', "name",
        'description', "description",
        'notes', 'Created during system upgrade - admin can customize'
      )
      WHERE "metadata" IS NULL
    `);

    console.log('Character class system enhancement completed!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove new column
    await queryRunner.query(`
      ALTER TABLE "character_classes" 
      DROP COLUMN IF EXISTS "metadata"
    `);

    // Note: We don't reverse the class type changes as it would be destructive
    // The legacy enum is kept for reference
    console.log('Reverted character class system enhancements');
  }
}
