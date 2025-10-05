import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Convert Pet Stats to 5 Core Stats System
 *
 * Changes:
 * 1. Convert pet_definitions.baseStats from old 6-stat format to new 5-stat format
 * 2. Reset user_pets.currentStats to null (will be recalculated on next access)
 *
 * Old format: { attack, defense, hp, critRate, critDamage, special }
 * New format: { strength, intelligence, dexterity, vitality, luck }
 */
export class ConvertPetStatsToCore1759630000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Starting pet stats migration...');

    // Get all pet definitions with their current stats
    const petDefs = await queryRunner.query(
      `SELECT id, "petId", "baseStats" FROM pet_definitions`,
    );

    console.log(`📊 Found ${petDefs.length} pet definitions to convert`);

    let convertedCount = 0;

    for (const pet of petDefs) {
      try {
        const oldStats = pet.baseStats;

        // Convert old stats to new format
        // Using approximation formulas to maintain relative power levels:
        // - strength: from attack (physical damage)
        // - intelligence: from attack (magic damage)
        // - dexterity: from critRate (accuracy/evasion)
        // - vitality: from hp (health pool)
        // - luck: from critDamage (crit chance/damage)

        const newStats = {
          strength: Math.max(10, Math.floor((oldStats.attack || 100) * 0.5)),
          intelligence: Math.max(
            10,
            Math.floor((oldStats.attack || 100) * 0.3),
          ),
          dexterity: Math.max(10, Math.floor((oldStats.critRate || 5) * 2)),
          vitality: Math.max(10, Math.floor((oldStats.hp || 500) / 10)),
          luck: Math.max(5, Math.floor((oldStats.critDamage || 150) / 15)),
        };

        await queryRunner.query(
          `UPDATE pet_definitions SET "baseStats" = $1 WHERE id = $2`,
          [JSON.stringify(newStats), pet.id],
        );

        convertedCount++;

        console.log(`  ✅ Converted ${pet.petId}:`, {
          old: `ATK:${oldStats.attack} DEF:${oldStats.defense} HP:${oldStats.hp}`,
          new: `STR:${newStats.strength} INT:${newStats.intelligence} DEX:${newStats.dexterity} VIT:${newStats.vitality} LUK:${newStats.luck}`,
        });
      } catch (error) {
        console.error(`  ❌ Failed to convert pet ${pet.petId}:`, error);
        throw error;
      }
    }

    // Reset all user pets' currentStats to null (will be recalculated on next access)
    await queryRunner.query(`UPDATE user_pets SET "currentStats" = NULL`);

    console.log(`✅ Migration completed:`);
    console.log(
      `   - Converted ${convertedCount}/${petDefs.length} pet definitions`,
    );
    console.log(
      `   - Reset all user pet stats (will recalculate on next access)`,
    );
    console.log(
      `✨ Pet stats system is now using 5 core stats (STR, INT, DEX, VIT, LUK)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️  Rolling back pet stats migration...');
    console.log(
      '⚠️  WARNING: This rollback is approximate and may not restore exact original values!',
    );

    // Get all pet definitions
    const petDefs = await queryRunner.query(
      `SELECT id, "petId", "baseStats" FROM pet_definitions`,
    );

    console.log(`📊 Found ${petDefs.length} pet definitions to rollback`);

    for (const pet of petDefs) {
      try {
        const newStats = pet.baseStats;

        // Convert back to old format (approximate)
        const oldStats = {
          attack: Math.floor(
            (newStats.strength || 10) * 2 + (newStats.intelligence || 10) * 0.6,
          ),
          defense: Math.floor((newStats.vitality || 10) * 2),
          hp: Math.floor((newStats.vitality || 10) * 10),
          critRate: Math.floor((newStats.dexterity || 10) * 0.5),
          critDamage: Math.floor((newStats.luck || 5) * 15),
          special: 0,
        };

        await queryRunner.query(
          `UPDATE pet_definitions SET "baseStats" = $1 WHERE id = $2`,
          [JSON.stringify(oldStats), pet.id],
        );

        console.log(`  ✅ Rolled back ${pet.petId}`);
      } catch (error) {
        console.error(`  ❌ Failed to rollback pet ${pet.petId}:`, error);
        throw error;
      }
    }

    // Reset user pets' currentStats
    await queryRunner.query(`UPDATE user_pets SET "currentStats" = NULL`);

    console.log(`✅ Rollback completed`);
    console.log(
      `⚠️  Note: Rollback is approximate. Consider restoring from backup if exact values are needed.`,
    );
  }
}
