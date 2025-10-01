import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsEquippedToPlayerSkills1759288154523
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add isEquipped column to player_skills
    await queryRunner.query(`
            ALTER TABLE player_skills 
            ADD COLUMN "isEquipped" BOOLEAN NOT NULL DEFAULT false
        `);

    // By default, equip up to 3 passive skills and 4 active skills per player
    // This query equips the first 3 passive skills and first 4 active skills for each user
    await queryRunner.query(`
            WITH ranked_skills AS (
                SELECT 
                    ps.id,
                    ps."userId",
                    sd."skillType",
                    ROW_NUMBER() OVER (
                        PARTITION BY ps."userId", sd."skillType" 
                        ORDER BY ps."unlockedAt" ASC
                    ) as rn
                FROM player_skills ps
                INNER JOIN skill_definitions sd ON ps."skillDefinitionId" = sd.id
            )
            UPDATE player_skills
            SET "isEquipped" = true
            WHERE id IN (
                SELECT id FROM ranked_skills
                WHERE 
                    ("skillType" = 'passive' AND rn <= 3) OR
                    ("skillType" = 'active' AND rn <= 4) OR
                    ("skillType" = 'toggle' AND rn <= 2)
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE player_skills 
            DROP COLUMN "isEquipped"
        `);
  }
}
