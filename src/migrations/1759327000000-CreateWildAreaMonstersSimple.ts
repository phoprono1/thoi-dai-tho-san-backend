import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWildAreaMonstersSimple1759327000000
  implements MigrationInterface
{
  name = 'CreateWildAreaMonstersSimple1759327000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "wildarea_monsters" (
        "id" SERIAL NOT NULL,
        "monsterId" integer NOT NULL,
        "minLevel" integer NOT NULL DEFAULT '1',
        "maxLevel" integer NOT NULL DEFAULT '50',
        "spawnWeight" numeric(5,2) NOT NULL DEFAULT '1',
        "isActive" boolean NOT NULL DEFAULT true,
        "description" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wildarea_monsters" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "wildarea_monsters" 
      ADD CONSTRAINT "FK_wildarea_monsters_monsterId" 
      FOREIGN KEY ("monsterId") REFERENCES "monsters"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_wildarea_monsters_monsterId" ON "wildarea_monsters" ("monsterId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_wildarea_monsters_level_range" ON "wildarea_monsters" ("minLevel", "maxLevel")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_wildarea_monsters_level_range"`);
    await queryRunner.query(`DROP INDEX "IDX_wildarea_monsters_monsterId"`);
    await queryRunner.query(
      `ALTER TABLE "wildarea_monsters" DROP CONSTRAINT "FK_wildarea_monsters_monsterId"`,
    );
    await queryRunner.query(`DROP TABLE "wildarea_monsters"`);
  }
}
