import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixStoryEventUserContribNumericFields1760707997160
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix string values in story_event_user_contrib table to proper numeric values
    await queryRunner.query(`
      UPDATE story_event_user_contrib
      SET "dungeonClears" = CASE
        WHEN CAST("dungeonClears" AS TEXT) ~ '^[0-9]+$' THEN CAST(CAST("dungeonClears" AS TEXT) AS BIGINT)
        ELSE 0
      END,
      "enemyKills" = CASE
        WHEN CAST("enemyKills" AS TEXT) ~ '^[0-9]+$' THEN CAST(CAST("enemyKills" AS TEXT) AS BIGINT)
        ELSE 0
      END,
      "itemsContributed" = CASE
        WHEN CAST("itemsContributed" AS TEXT) ~ '^[0-9]+$' THEN CAST(CAST("itemsContributed" AS TEXT) AS BIGINT)
        ELSE 0
      END,
      "totalScore" = CASE
        WHEN CAST("totalScore" AS TEXT) ~ '^[0-9]+$' THEN CAST(CAST("totalScore" AS TEXT) AS BIGINT)
        ELSE 0
      END
      WHERE CAST("dungeonClears" AS TEXT) !~ '^[0-9]*$'
         OR CAST("enemyKills" AS TEXT) !~ '^[0-9]*$'
         OR CAST("itemsContributed" AS TEXT) !~ '^[0-9]*$'
         OR CAST("totalScore" AS TEXT) !~ '^[0-9]*$'
    `);
  }

  public async down(): Promise<void> {
    // No need to revert this migration as it's a data fix
  }
}
