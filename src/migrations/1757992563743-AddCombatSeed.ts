import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCombatSeed1757992563743 implements MigrationInterface {
  name = 'AddCombatSeed1757992563743';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "combat_result" ADD "seed" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "combat_result" DROP COLUMN "seed"`);
  }
}
