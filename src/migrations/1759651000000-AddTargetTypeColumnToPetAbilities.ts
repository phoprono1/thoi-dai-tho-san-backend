import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTargetTypeColumnToPetAbilities1759651000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Use raw SQL to add all missing columns if not exist
    await queryRunner.query(`
      ALTER TABLE pet_abilities 
      ADD COLUMN IF NOT EXISTS "targetType" varchar(20) DEFAULT 'enemy',
      ADD COLUMN IF NOT EXISTS "icon" varchar(255),
      ADD COLUMN IF NOT EXISTS "rarity" int DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now();
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN pet_abilities."targetType" IS 'enemy, ally, self, all_enemies, all_allies';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN pet_abilities."icon" IS 'Icon emoji or image URL';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN pet_abilities."rarity" IS '1-5 star rarity';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN pet_abilities."isActive" IS 'Can be disabled by admin';
    `);

    console.log(
      'Added missing columns to pet_abilities (targetType, icon, rarity, isActive, timestamps)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pet_abilities 
      DROP COLUMN IF EXISTS "targetType";
    `);
  }
}
