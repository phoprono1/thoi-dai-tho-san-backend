import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSkillPointsSystem1759286782628 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add skill points fields to user_stat table (singular, not plural!)
    await queryRunner.query(`
            ALTER TABLE user_stat 
            ADD COLUMN "availableSkillPoints" INT DEFAULT 0,
            ADD COLUMN "totalSkillPointsEarned" INT DEFAULT 0
        `);

    // Add skill system enhancement fields to skill_definitions table
    await queryRunner.query(`
            ALTER TABLE skill_definitions 
            ADD COLUMN prerequisites JSON DEFAULT '[]',
            ADD COLUMN "requiredSkillLevels" JSON DEFAULT '{}',
            ADD COLUMN "classRestrictions" JSON DEFAULT '[]'
        `);

    // Grant initial skill points to existing users based on their level
    // Formula: (level - 1) skill points per user
    // PostgreSQL syntax with FROM clause
    await queryRunner.query(`
            UPDATE user_stat us
            SET 
                "availableSkillPoints" = GREATEST(0, u.level - 1),
                "totalSkillPointsEarned" = GREATEST(0, u.level - 1)
            FROM "user" u
            WHERE us."userId" = u.id AND u.level > 1
        `);

    // Calculate and deduct already-spent skill points
    // Each player_skill costs skillPointCost * level
    await queryRunner.query(`
            UPDATE user_stat us
            SET "availableSkillPoints" = "availableSkillPoints" - (
                SELECT COALESCE(SUM(sd."skillPointCost" * ps.level), 0)
                FROM player_skills ps
                INNER JOIN skill_definitions sd ON ps."skillDefinitionId" = sd.id
                WHERE ps."userId" = us."userId"
            )
            WHERE EXISTS (
                SELECT 1 FROM player_skills WHERE "userId" = us."userId"
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove skill points fields from user_stat
    await queryRunner.query(`
            ALTER TABLE user_stat 
            DROP COLUMN "availableSkillPoints",
            DROP COLUMN "totalSkillPointsEarned"
        `);

    // Remove skill system enhancement fields from skill_definitions
    await queryRunner.query(`
            ALTER TABLE skill_definitions 
            DROP COLUMN prerequisites,
            DROP COLUMN "requiredSkillLevels",
            DROP COLUMN "classRestrictions"
        `);
  }
}
