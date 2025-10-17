import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequirementsAndScoringToStoryEvents1760700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE story_events ADD COLUMN IF NOT EXISTS requirements jsonb NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE story_events ADD COLUMN IF NOT EXISTS scoring_weights jsonb NULL;`,
    );

    // Optional: backfill scoring_weights from existing rewardConfig if present
    await queryRunner.query(
      `UPDATE story_events SET scoring_weights = jsonb_build_object('dungeonClear',10,'enemyKill',1,'itemDonate',5) WHERE scoring_weights IS NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE story_events DROP COLUMN IF EXISTS scoring_weights;`,
    );
    await queryRunner.query(
      `ALTER TABLE story_events DROP COLUMN IF EXISTS requirements;`,
    );
  }
}
