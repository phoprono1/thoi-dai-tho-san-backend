import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConvertEvolutionStatsToCoreMult1738810000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log(
      '🔄 Converting pet evolution stat multipliers to core stats format...',
    );

    // Get all evolutions
    const evolutions = await queryRunner.query(`
      SELECT id, "statMultipliers"
      FROM pet_evolutions
    `);

    console.log(`Found ${evolutions.length} evolutions to convert`);

    for (const evolution of evolutions) {
      const oldStats = evolution.statMultipliers;

      // Convert old format (attack, defense, hp, critRate, critDamage)
      // to new format (strength, intelligence, dexterity, vitality, luck)
      const newStats = {
        strength: oldStats.attack || 1.5, // Attack -> Strength
        intelligence: oldStats.attack || 1.5, // Attack -> Intelligence
        dexterity: oldStats.defense || 1.5, // Defense -> Dexterity
        vitality: oldStats.hp || 1.5, // HP -> Vitality
        luck: oldStats.critRate || 1.5, // CritRate -> Luck
      };

      await queryRunner.query(
        `
        UPDATE pet_evolutions
        SET "statMultipliers" = $1
        WHERE id = $2
      `,
        [JSON.stringify(newStats), evolution.id],
      );

      console.log(
        `✅ Converted evolution ${evolution.id}: ${JSON.stringify(oldStats)} -> ${JSON.stringify(newStats)}`,
      );
    }

    console.log('✅ All evolutions converted to new stat format');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️  Rolling back stat multiplier conversion...');

    // Get all evolutions
    const evolutions = await queryRunner.query(`
      SELECT id, "statMultipliers"
      FROM pet_evolutions
    `);

    for (const evolution of evolutions) {
      const newStats = evolution.statMultipliers;

      // Convert back to old format
      const oldStats = {
        attack: newStats.strength || 1.5,
        defense: newStats.dexterity || 1.5,
        hp: newStats.vitality || 1.5,
        critRate: newStats.luck || 1.5,
        critDamage: 1.0,
      };

      await queryRunner.query(
        `
        UPDATE pet_evolutions
        SET "statMultipliers" = $1
        WHERE id = $2
      `,
        [JSON.stringify(oldStats), evolution.id],
      );
    }

    console.log('✅ Rollback completed');
  }
}
