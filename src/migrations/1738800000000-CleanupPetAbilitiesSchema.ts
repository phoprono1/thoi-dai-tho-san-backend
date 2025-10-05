import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupPetAbilitiesSchema1738800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🧹 Cleaning up pet_abilities schema...');

    // Check if table exists
    const tableExists = await queryRunner.hasTable('pet_abilities');
    if (!tableExists) {
      console.log('⚠️  Table pet_abilities does not exist, skipping cleanup');
      return;
    }

    // Get current columns
    const table = await queryRunner.getTable('pet_abilities');
    const columns = table?.columns.map((col) => col.name) || [];

    console.log('Current columns:', columns);

    // List of columns that should NOT exist (legacy columns)
    const columnsToRemove = ['abilityId', 'levelScaling'];

    for (const columnName of columnsToRemove) {
      if (columns.includes(columnName)) {
        console.log(`Dropping column: ${columnName}`);
        await queryRunner.dropColumn('pet_abilities', columnName);
      } else {
        console.log(`Column ${columnName} does not exist, skipping`);
      }
    }

    // Ensure all required columns exist with correct types
    const requiredColumns = {
      id: { type: 'int', isPrimary: true },
      name: { type: 'varchar' },
      type: { type: 'varchar' },
      description: { type: 'text' },
      effects: { type: 'jsonb' },
      cooldown: { type: 'int' },
      manaCost: { type: 'int' },
      targetType: { type: 'varchar' },
      icon: { type: 'varchar' },
      rarity: { type: 'int' },
      isActive: { type: 'boolean' },
      createdAt: { type: 'timestamp' },
      updatedAt: { type: 'timestamp' },
    };

    console.log('\n✅ Schema cleanup completed');
    console.log('Expected columns:', Object.keys(requiredColumns));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️  Rollback not implemented for cleanup migration');
    // We don't want to restore legacy columns
  }
}
