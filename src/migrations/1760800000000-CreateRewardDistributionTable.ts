import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRewardDistributionTable1760800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE story_events ADD COLUMN IF NOT EXISTS "rewardDistributedAt" timestamptz NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS story_event_reward_distribution (
        id serial PRIMARY KEY,
        "storyEventId" integer NOT NULL,
        "distributedAt" timestamptz NOT NULL DEFAULT now(),
        "executedBy" integer NULL,
        "config" jsonb NULL,
        "summary" jsonb NULL
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_serd_event ON story_event_reward_distribution("storyEventId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_serd_event;`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS story_event_reward_distribution;`,
    );
    await queryRunner.query(
      `ALTER TABLE story_events DROP COLUMN IF EXISTS "rewardDistributedAt";`,
    );
  }
}
