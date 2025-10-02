import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManaoPotionToConsumableType1759391873828
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'mana_potion' to the consumable_type enum
    await queryRunner.query(`
      ALTER TYPE "item_consumabletype_enum" ADD VALUE IF NOT EXISTS 'mana_potion';
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // You would need to recreate the enum type to remove a value
    // For now, we'll leave this as a no-op since removing enum values is complex
    console.log(
      'Removing enum values is not supported in PostgreSQL. Manual intervention required.',
    );
  }
}
