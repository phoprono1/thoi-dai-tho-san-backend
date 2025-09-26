import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCraftingSystem1758787332314 implements MigrationInterface {
  name = 'AddCraftingSystem1758787332314';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create crafting_recipes table
    await queryRunner.query(`
      CREATE TABLE "crafting_recipes" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "resultItemId" integer NOT NULL,
        "resultQuantity" integer NOT NULL DEFAULT 1,
        "materials" jsonb NOT NULL,
        "craftingLevel" integer NOT NULL DEFAULT 1,
        "goldCost" integer NOT NULL DEFAULT 0,
        "craftingTime" integer NOT NULL DEFAULT 60,
        "isActive" boolean NOT NULL DEFAULT true,
        "category" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_crafting_recipes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_crafting_recipes_result_item" FOREIGN KEY ("resultItemId") REFERENCES "item"("id") ON DELETE CASCADE
      )
    `);

    // Create index for better performance
    await queryRunner.query(`
      CREATE INDEX "IDX_crafting_recipes_category" ON "crafting_recipes" ("category")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_crafting_recipes_level" ON "crafting_recipes" ("craftingLevel")
    `);

    // Note: Items and recipes will be created via admin interface or separate data seeding
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes and table
    await queryRunner.query(`DROP INDEX "IDX_crafting_recipes_level"`);
    await queryRunner.query(`DROP INDEX "IDX_crafting_recipes_category"`);
    await queryRunner.query(`DROP TABLE "crafting_recipes"`);
  }
}
