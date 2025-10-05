import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePetSystemComplete1730636800000
  implements MigrationInterface
{
  name = 'CreatePetSystemComplete1730636800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing pet tables if they exist (safety check)
    await queryRunner.query(`DROP TABLE IF EXISTS "pet_gacha_pulls" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "user_pet_banner_pity" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "pet_banners" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pet_feeding_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pet_equipment" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pet_abilities" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_pets" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pet_evolutions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pet_definitions" CASCADE`);

    // Create pet_definitions table
    await queryRunner.query(`
      CREATE TABLE "pet_definitions" (
        "id" SERIAL NOT NULL,
        "petId" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text NOT NULL,
        "rarity" integer NOT NULL DEFAULT '1',
        "element" character varying NOT NULL DEFAULT 'neutral',
        "baseStats" jsonb NOT NULL,
        "images" jsonb NOT NULL DEFAULT '[]',
        "maxLevel" integer NOT NULL DEFAULT '10',
        "maxEvolutionStage" integer NOT NULL DEFAULT '3',
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_pet_definitions_petId" UNIQUE ("petId"),
        CONSTRAINT "PK_pet_definitions" PRIMARY KEY ("id")
      )
    `);

    // Create pet_evolutions table
    await queryRunner.query(`
      CREATE TABLE "pet_evolutions" (
        "id" SERIAL NOT NULL,
        "basePetId" integer NOT NULL,
        "evolutionStage" integer NOT NULL,
        "evolutionName" character varying NOT NULL,
        "requiredItems" jsonb NOT NULL,
        "requiredLevel" integer NOT NULL,
        "requiredPets" jsonb NOT NULL,
        "statMultipliers" jsonb NOT NULL,
        "newImages" jsonb NOT NULL DEFAULT '[]',
        "newAbilities" jsonb,
        "evolutionDescription" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pet_evolutions" PRIMARY KEY ("id")
      )
    `);

    // Create user_pets table
    await queryRunner.query(`
      CREATE TABLE "user_pets" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "petDefinitionId" integer NOT NULL,
        "level" integer NOT NULL DEFAULT '1',
        "experience" integer NOT NULL DEFAULT '0',
        "evolutionStage" integer NOT NULL DEFAULT '0',
        "currentSkinIndex" integer NOT NULL DEFAULT '0',
        "unlockedSkins" jsonb NOT NULL DEFAULT '[]',
        "isActive" boolean NOT NULL DEFAULT false,
        "currentStats" jsonb,
        "equippedItems" jsonb NOT NULL DEFAULT '[]',
        "friendship" integer NOT NULL DEFAULT '0',
        "obtainedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_pets" PRIMARY KEY ("id")
      )
    `);

    // Create pet_abilities table
    await queryRunner.query(`
      CREATE TABLE "pet_abilities" (
        "id" SERIAL NOT NULL,
        "abilityId" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text NOT NULL,
        "type" character varying NOT NULL,
        "effects" jsonb NOT NULL,
        "levelScaling" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_pet_abilities_abilityId" UNIQUE ("abilityId"),
        CONSTRAINT "PK_pet_abilities" PRIMARY KEY ("id")
      )
    `);

    // Create pet_equipment table
    await queryRunner.query(`
      CREATE TABLE "pet_equipment" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "slot" character varying NOT NULL,
        "rarity" integer NOT NULL DEFAULT '1',
        "statBonuses" jsonb NOT NULL,
        "setBonus" jsonb,
        "compatibleElements" jsonb NOT NULL DEFAULT '[]',
        "image" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pet_equipment" PRIMARY KEY ("id")
      )
    `);

    // Create pet_feeding_items table
    await queryRunner.query(`
      CREATE TABLE "pet_feeding_items" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "description" text NOT NULL,
        "type" character varying NOT NULL,
        "effects" jsonb NOT NULL,
        "compatibleElements" jsonb NOT NULL DEFAULT '[]',
        "rarity" integer NOT NULL DEFAULT '1',
        "image" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pet_feeding_items" PRIMARY KEY ("id")
      )
    `);

    // Create pet_banners table
    await queryRunner.query(`
      CREATE TABLE "pet_banners" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "description" text NOT NULL,
        "bannerType" character varying NOT NULL,
        "costPerPull" integer NOT NULL,
        "guaranteedRarity" integer NOT NULL,
        "guaranteedPullCount" integer NOT NULL,
        "featuredPets" jsonb NOT NULL,
        "dropRates" jsonb NOT NULL,
        "startDate" TIMESTAMP NOT NULL,
        "endDate" TIMESTAMP NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "bannerImage" text,
        "sortOrder" integer NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pet_banners" PRIMARY KEY ("id")
      )
    `);

    // Create user_pet_banner_pity table
    await queryRunner.query(`
      CREATE TABLE "user_pet_banner_pity" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "bannerId" integer NOT NULL,
        "pullCount" integer NOT NULL DEFAULT '0',
        "totalPulls" integer NOT NULL DEFAULT '0',
        "lastPullDate" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_pet_banner_pity" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_pet_banner_pity_user_banner" UNIQUE ("userId", "bannerId")
      )
    `);

    // Create pet_gacha_pulls table
    await queryRunner.query(`
      CREATE TABLE "pet_gacha_pulls" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "bannerId" integer NOT NULL,
        "petObtainedId" integer NOT NULL,
        "pullType" character varying NOT NULL,
        "wasGuaranteed" boolean NOT NULL DEFAULT false,
        "wasFeatured" boolean NOT NULL DEFAULT false,
        "pulledAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pet_gacha_pulls" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "pet_evolutions" 
      ADD CONSTRAINT "FK_pet_evolutions_basePet" 
      FOREIGN KEY ("basePetId") REFERENCES "pet_definitions"("id") 
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_pets" 
      ADD CONSTRAINT "FK_user_pets_user" 
      FOREIGN KEY ("userId") REFERENCES "user"("id") 
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_pets" 
      ADD CONSTRAINT "FK_user_pets_petDefinition" 
      FOREIGN KEY ("petDefinitionId") REFERENCES "pet_definitions"("id") 
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_pet_banner_pity" 
      ADD CONSTRAINT "FK_user_pet_banner_pity_user" 
      FOREIGN KEY ("userId") REFERENCES "user"("id") 
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_pet_banner_pity" 
      ADD CONSTRAINT "FK_user_pet_banner_pity_banner" 
      FOREIGN KEY ("bannerId") REFERENCES "pet_banners"("id") 
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "pet_gacha_pulls" 
      ADD CONSTRAINT "FK_pet_gacha_pulls_user" 
      FOREIGN KEY ("userId") REFERENCES "user"("id") 
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "pet_gacha_pulls" 
      ADD CONSTRAINT "FK_pet_gacha_pulls_banner" 
      FOREIGN KEY ("bannerId") REFERENCES "pet_banners"("id") 
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "pet_gacha_pulls" 
      ADD CONSTRAINT "FK_pet_gacha_pulls_pet" 
      FOREIGN KEY ("petObtainedId") REFERENCES "pet_definitions"("id") 
      ON DELETE CASCADE
    `);

    // Create indexes for performance
    await queryRunner.query(
      `CREATE INDEX "IDX_pet_definitions_rarity" ON "pet_definitions" ("rarity")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pet_definitions_element" ON "pet_definitions" ("element")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_pets_userId" ON "user_pets" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_pets_isActive" ON "user_pets" ("isActive")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pet_gacha_pulls_userId" ON "pet_gacha_pulls" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pet_gacha_pulls_pulledAt" ON "pet_gacha_pulls" ("pulledAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pet_banners_isActive" ON "pet_banners" ("isActive")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pet_banners_dates" ON "pet_banners" ("startDate", "endDate")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints first
    await queryRunner.query(
      `ALTER TABLE "pet_gacha_pulls" DROP CONSTRAINT "FK_pet_gacha_pulls_pet"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pet_gacha_pulls" DROP CONSTRAINT "FK_pet_gacha_pulls_banner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pet_gacha_pulls" DROP CONSTRAINT "FK_pet_gacha_pulls_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_pet_banner_pity" DROP CONSTRAINT "FK_user_pet_banner_pity_banner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_pet_banner_pity" DROP CONSTRAINT "FK_user_pet_banner_pity_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_pets" DROP CONSTRAINT "FK_user_pets_petDefinition"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_pets" DROP CONSTRAINT "FK_user_pets_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pet_evolutions" DROP CONSTRAINT "FK_pet_evolutions_basePet"`,
    );

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_pet_banners_dates"`);
    await queryRunner.query(`DROP INDEX "IDX_pet_banners_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_pet_gacha_pulls_pulledAt"`);
    await queryRunner.query(`DROP INDEX "IDX_pet_gacha_pulls_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_user_pets_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_user_pets_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_pet_definitions_element"`);
    await queryRunner.query(`DROP INDEX "IDX_pet_definitions_rarity"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "pet_gacha_pulls"`);
    await queryRunner.query(`DROP TABLE "user_pet_banner_pity"`);
    await queryRunner.query(`DROP TABLE "pet_banners"`);
    await queryRunner.query(`DROP TABLE "pet_feeding_items"`);
    await queryRunner.query(`DROP TABLE "pet_equipment"`);
    await queryRunner.query(`DROP TABLE "pet_abilities"`);
    await queryRunner.query(`DROP TABLE "user_pets"`);
    await queryRunner.query(`DROP TABLE "pet_evolutions"`);
    await queryRunner.query(`DROP TABLE "pet_definitions"`);
  }
}
