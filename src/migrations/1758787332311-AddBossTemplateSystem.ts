import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBossTemplateSystem1758787332311 implements MigrationInterface {
  name = 'AddBossTemplateSystem1758787332311';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create boss_template table
    await queryRunner.query(`
      CREATE TABLE "boss_template" (
        "id" SERIAL NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" text NOT NULL,
        "level" integer NOT NULL,
        "image" text,
        "stats" jsonb NOT NULL,
        "damagePhases" jsonb NOT NULL,
        "defaultRewards" jsonb NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "category" character varying(50),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_boss_template_id" PRIMARY KEY ("id")
      )
    `);

    // Add new columns to world_boss table
    await queryRunner.query(`
      ALTER TABLE "world_boss" 
      ADD COLUMN "templateId" integer,
      ADD COLUMN "customRewards" jsonb
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "world_boss" 
      ADD CONSTRAINT "FK_world_boss_template" 
      FOREIGN KEY ("templateId") REFERENCES "boss_template"("id") ON DELETE SET NULL
    `);

    // Insert some default boss templates
    await queryRunner.query(`
      INSERT INTO "boss_template" ("name", "description", "level", "stats", "damagePhases", "defaultRewards", "category") VALUES
      (
        'Ancient Fire Dragon',
        'Một con rồng lửa cổ đại với sức mạnh khủng khiếp',
        50,
        '{"attack": 5000, "defense": 3000, "critRate": 15, "critDamage": 200}',
        '{"phase1Threshold": 1000000, "phase2Threshold": 3000000, "phase3Threshold": 5000000}',
        '{"individual": {"top1": {"gold": 100000, "experience": 50000, "items": []}, "top2": {"gold": 70000, "experience": 35000, "items": []}, "top3": {"gold": 50000, "experience": 25000, "items": []}, "top4to10": {"gold": 30000, "experience": 15000, "items": []}, "top11to30": {"gold": 15000, "experience": 7500, "items": []}}, "guild": {"top1": {"gold": 200000, "experience": 100000, "items": []}, "top2to5": {"gold": 100000, "experience": 50000, "items": []}, "top6to10": {"gold": 50000, "experience": 25000, "items": []}}}',
        'dragon'
      ),
      (
        'Shadow Demon Lord',
        'Lãnh chúa ác ma từ vùng đất bóng tối',
        60,
        '{"attack": 6000, "defense": 3500, "critRate": 20, "critDamage": 250}',
        '{"phase1Threshold": 1500000, "phase2Threshold": 4000000, "phase3Threshold": 6500000}',
        '{"individual": {"top1": {"gold": 120000, "experience": 60000, "items": []}, "top2": {"gold": 80000, "experience": 40000, "items": []}, "top3": {"gold": 60000, "experience": 30000, "items": []}, "top4to10": {"gold": 35000, "experience": 18000, "items": []}, "top11to30": {"gold": 18000, "experience": 9000, "items": []}}, "guild": {"top1": {"gold": 240000, "experience": 120000, "items": []}, "top2to5": {"gold": 120000, "experience": 60000, "items": []}, "top6to10": {"gold": 60000, "experience": 30000, "items": []}}}',
        'demon'
      ),
      (
        'Crystal Golem',
        'Người khổng lồ pha lê với sức phòng thủ tuyệt đối',
        45,
        '{"attack": 4000, "defense": 4000, "critRate": 10, "critDamage": 150}',
        '{"phase1Threshold": 800000, "phase2Threshold": 2500000, "phase3Threshold": 4200000}',
        '{"individual": {"top1": {"gold": 80000, "experience": 40000, "items": []}, "top2": {"gold": 60000, "experience": 30000, "items": []}, "top3": {"gold": 40000, "experience": 20000, "items": []}, "top4to10": {"gold": 25000, "experience": 12000, "items": []}, "top11to30": {"gold": 12000, "experience": 6000, "items": []}}, "guild": {"top1": {"gold": 160000, "experience": 80000, "items": []}, "top2to5": {"gold": 80000, "experience": 40000, "items": []}, "top6to10": {"gold": 40000, "experience": 20000, "items": []}}}',
        'elemental'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "world_boss" 
      DROP CONSTRAINT "FK_world_boss_template"
    `);

    // Remove new columns from world_boss
    await queryRunner.query(`
      ALTER TABLE "world_boss" 
      DROP COLUMN "templateId",
      DROP COLUMN "customRewards"
    `);

    // Drop boss_template table
    await queryRunner.query(`DROP TABLE "boss_template"`);
  }
}
