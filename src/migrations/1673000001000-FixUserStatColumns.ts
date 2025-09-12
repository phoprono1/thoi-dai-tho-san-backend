import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixUserStatColumns1673000001000 implements MigrationInterface {
  name = 'FixUserStatColumns1673000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing user_stat table and recreate with correct columns
    await queryRunner.query(`DROP TABLE IF EXISTS "user_stat"`);
    
    // Create user_stat table with correct column names matching the entity
    await queryRunner.query(`
      CREATE TABLE "user_stat" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL DEFAULT '0',
        "maxHp" integer NOT NULL DEFAULT '100',
        "currentHp" integer NOT NULL DEFAULT '100',
        "attack" integer NOT NULL DEFAULT '10',
        "defense" integer NOT NULL DEFAULT '5',
        "strength" integer NOT NULL DEFAULT '10',
        "intelligence" integer NOT NULL DEFAULT '10',
        "dexterity" integer NOT NULL DEFAULT '10',
        "vitality" integer NOT NULL DEFAULT '10',
        "luck" integer NOT NULL DEFAULT '10',
        "critRate" integer NOT NULL DEFAULT '0',
        "critDamage" integer NOT NULL DEFAULT '150',
        "comboRate" integer NOT NULL DEFAULT '0',
        "counterRate" integer NOT NULL DEFAULT '0',
        "lifesteal" integer NOT NULL DEFAULT '0',
        "armorPen" integer NOT NULL DEFAULT '0',
        "dodgeRate" integer NOT NULL DEFAULT '0',
        "accuracy" integer NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_stat_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_stat_userId" UNIQUE ("userId")
      )
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "user_stat" ADD CONSTRAINT "FK_user_stat_userId" 
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the table
    await queryRunner.query(`DROP TABLE IF EXISTS "user_stat"`);
    
    // Recreate original table (if needed for rollback)
    await queryRunner.query(`
      CREATE TABLE "user_stat" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "baseHp" integer NOT NULL DEFAULT '100',
        "baseAttack" integer NOT NULL DEFAULT '10',
        "baseDefense" integer NOT NULL DEFAULT '5',
        "critRate" integer NOT NULL DEFAULT '5',
        "critDamage" integer NOT NULL DEFAULT '150',
        "hitRate" integer NOT NULL DEFAULT '80',
        "dodgeRate" integer NOT NULL DEFAULT '5',
        "blockRate" integer NOT NULL DEFAULT '0',
        "blockValue" integer NOT NULL DEFAULT '0',
        "counterRate" integer NOT NULL DEFAULT '0',
        "lifesteal" integer NOT NULL DEFAULT '0',
        "penetration" integer NOT NULL DEFAULT '0',
        "comboRate" integer NOT NULL DEFAULT '0',
        "doubleDropRate" integer NOT NULL DEFAULT '0',
        "expBonus" integer NOT NULL DEFAULT '0',
        "goldBonus" integer NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_stat_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_stat_userId" UNIQUE ("userId")
      )
    `);
  }
}