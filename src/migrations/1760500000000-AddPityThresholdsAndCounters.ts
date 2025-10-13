import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPityThresholdsAndCounters1760500000000
  implements MigrationInterface
{
  name = 'AddPityThresholdsAndCounters1760500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new JSONB columns
    await queryRunner.query(
      `ALTER TABLE "pet_banners" ADD COLUMN IF NOT EXISTS "pityThresholds" jsonb NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_pet_banner_pity" ADD COLUMN IF NOT EXISTS "thresholdCounters" jsonb NULL`,
    );

    // Backfill pet_banners.pityThresholds from legacy guaranteed fields so old banners keep same behavior
    await queryRunner.query(`
      UPDATE "pet_banners"
      SET "pityThresholds" = jsonb_build_array(
        jsonb_build_object('rarity', "guaranteedRarity", 'pullCount', "guaranteedPullCount")
      )
      WHERE "pityThresholds" IS NULL
    `);

    // Backfill user_pet_banner_pity.thresholdCounters so existing user pity progress is preserved
    // For each user_pity row, map every configured threshold rarity to the existing pullCount value.
    await queryRunner.query(`
      UPDATE "user_pet_banner_pity" up
      SET "thresholdCounters" = (
        SELECT jsonb_object_agg((t->>'rarity'), up."pullCount")
        FROM "pet_banners" pb, jsonb_array_elements(pb."pityThresholds") as t
        WHERE pb.id = up."bannerId"
      )
      WHERE EXISTS (SELECT 1 FROM "pet_banners" pb WHERE pb.id = up."bannerId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_pet_banner_pity" DROP COLUMN IF EXISTS "thresholdCounters"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pet_banners" DROP COLUMN IF EXISTS "pityThresholds"`,
    );
  }
}
