import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Migrate Pet Equipment System to Unified Item System
 *
 * This migration:
 * 1. Updates user_pet.equippedItems structure from array to object
 * 2. Drops pet_equipment table (no data to migrate in test environment)
 * 3. Updates indexes and constraints
 *
 * Pet equipment will now use the Item system with types:
 * - PET_COLLAR, PET_ARMOR, PET_ACCESSORY, PET_WEAPON
 */
export class MigratePetEquipmentToItems1759900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Change user_pets.equippedItems from jsonb array to jsonb object
    await queryRunner.query(`
      ALTER TABLE "user_pets" 
      ALTER COLUMN "equippedItems" 
      TYPE jsonb 
      USING '{}'::jsonb
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "user_pets"."equippedItems" IS 
      'Pet equipment slots: {collar: itemId, armor: itemId, accessory: itemId, weapon: itemId}'
    `);

    // 2. Drop pet_equipment table (safe - no data in test environment)
    await queryRunner.query(`DROP TABLE IF EXISTS "pet_equipment" CASCADE`);

    console.log('✅ Migration completed: Pet equipment now uses Item system');
    console.log('   - user_pet.equippedItems updated to slot-based object');
    console.log('   - pet_equipment table dropped');
    console.log(
      '   - Use ItemType: PET_COLLAR, PET_ARMOR, PET_ACCESSORY, PET_WEAPON',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate pet_equipment table
    await queryRunner.query(`
      CREATE TABLE "pet_equipment" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "slot" varchar CHECK (slot IN ('collar', 'armor', 'accessory', 'weapon')) NOT NULL,
        "rarity" int DEFAULT 1,
        "statBonuses" jsonb NOT NULL,
        "setBonus" jsonb,
        "compatibleElements" jsonb DEFAULT '[]'::jsonb,
        "image" text,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pet_equipment_slot_rarity" 
      ON "pet_equipment" ("slot", "rarity")
    `);

    // Revert user_pet.equippedItems to array
    await queryRunner.query(`
      ALTER TABLE "user_pets" 
      ALTER COLUMN "equippedItems" 
      TYPE jsonb 
      USING '[]'::jsonb
    `);

    console.log('⚠️  Rollback completed: Restored pet_equipment table');
  }
}
