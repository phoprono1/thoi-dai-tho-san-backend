import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSkillCooldownToTurnBased1760100000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update cooldown values from seconds to turns
    // Assuming: 1 turn ≈ 5 seconds in old system
    // Examples: 15s → 3 turns, 20s → 4 turns, 30s → 6 turns

    console.log('🔄 Converting skill cooldowns from seconds to turns...');

    // Get all skills with cooldowns
    const skills = await queryRunner.query(`
            SELECT id, "skillId", name, cooldown 
            FROM skill_definitions 
            WHERE cooldown IS NOT NULL AND cooldown > 0
        `);

    for (const skill of skills) {
      // Convert seconds to turns (divide by 5, round up)
      const oldCooldown = skill.cooldown;
      const newCooldown = Math.max(1, Math.ceil(oldCooldown / 5));

      await queryRunner.query(
        `
                UPDATE skill_definitions 
                SET cooldown = $1 
                WHERE id = $2
            `,
        [newCooldown, skill.id],
      );

      console.log(
        `  ✅ ${skill.name} (${skill.skillId}): ${oldCooldown}s → ${newCooldown} turns`,
      );
    }

    console.log(
      `✅ Updated ${skills.length} skills from seconds to turn-based cooldowns`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert turns back to seconds (multiply by 5)
    console.log('🔄 Converting skill cooldowns from turns back to seconds...');

    const skills = await queryRunner.query(`
            SELECT id, "skillId", name, cooldown 
            FROM skill_definitions 
            WHERE cooldown IS NOT NULL AND cooldown > 0
        `);

    for (const skill of skills) {
      const oldCooldown = skill.cooldown;
      const newCooldown = oldCooldown * 5;

      await queryRunner.query(
        `
                UPDATE skill_definitions 
                SET cooldown = $1 
                WHERE id = $2
            `,
        [newCooldown, skill.id],
      );

      console.log(
        `  ✅ ${skill.name} (${skill.skillId}): ${oldCooldown} turns → ${newCooldown}s`,
      );
    }

    console.log(
      `✅ Reverted ${skills.length} skills from turn-based back to seconds`,
    );
  }
}
