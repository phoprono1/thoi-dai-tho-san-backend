import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAdminFields1734567890123 implements MigrationInterface {
  name = 'AddUserAdminFields1734567890123';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "isBanned" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "isAdmin" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "isDonor" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isDonor"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isAdmin"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isBanned"`);
  }
}
