import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Pet Equipment Types to Item enum
 *
 * Adds PET_COLLAR, PET_ARMOR, PET_ACCESSORY, PET_WEAPON to item.type enum
 * This allows items table to store pet equipment alongside player equipment
 */
export class AddPetEquipmentTypesToItems1759900100000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new pet equipment types to item type enum
    await queryRunner.query(`
      ALTER TYPE "item_type_enum" 
      ADD VALUE IF NOT EXISTS 'pet_collar'
    `);

    await queryRunner.query(`
      ALTER TYPE "item_type_enum" 
      ADD VALUE IF NOT EXISTS 'pet_armor'
    `);

    await queryRunner.query(`
      ALTER TYPE "item_type_enum" 
      ADD VALUE IF NOT EXISTS 'pet_accessory'
    `);

    await queryRunner.query(`
      ALTER TYPE "item_type_enum" 
      ADD VALUE IF NOT EXISTS 'pet_weapon'
    `);

    console.log(
      '✅ Migration completed: Pet equipment types added to Item enum',
    );
    console.log(
      '   - pet_collar, pet_armor, pet_accessory, pet_weapon now available',
    );
    console.log('   - Admins can now create pet equipment items');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support removing enum values directly
    // Would require recreating the entire enum type
    console.log(
      '⚠️  Cannot remove enum values in PostgreSQL - manual intervention required',
    );
    console.log('   To rollback: recreate item_type_enum without pet types');
  }
}
