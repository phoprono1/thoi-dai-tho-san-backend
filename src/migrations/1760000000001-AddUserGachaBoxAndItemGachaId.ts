import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserGachaBoxAndItemGachaId1760000000001
  implements MigrationInterface
{
  name = 'AddUserGachaBoxAndItemGachaId1760000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "item" ADD COLUMN "gacha_box_id" integer`,
    );

    await queryRunner.query(`
      CREATE TABLE "user_gacha_box" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "itemId" integer,
        "boxId" integer NOT NULL,
        "seed" text,
        "metadata" json,
        "expiresAt" TIMESTAMP,
        "consumed" boolean DEFAULT false,
        "consumedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "gacha_box_open_log" ADD COLUMN "userGachaBoxId" integer`,
    );

    await queryRunner.query(`
      ALTER TABLE "user_gacha_box"
      ADD CONSTRAINT "FK_user_gacha_box_box" FOREIGN KEY ("boxId") REFERENCES "gacha_box"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_gacha_box"
      ADD CONSTRAINT "FK_user_gacha_box_item" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "user_gacha_box"
      ADD CONSTRAINT "FK_user_gacha_box_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "gacha_box_open_log"
      ADD CONSTRAINT "FK_gacha_log_user_gacha_box" FOREIGN KEY ("userGachaBoxId") REFERENCES "user_gacha_box"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gacha_box_open_log" DROP CONSTRAINT "FK_gacha_log_user_gacha_box"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_gacha_box" DROP CONSTRAINT "FK_user_gacha_box_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_gacha_box" DROP CONSTRAINT "FK_user_gacha_box_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_gacha_box" DROP CONSTRAINT "FK_user_gacha_box_box"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gacha_box_open_log" DROP COLUMN "userGachaBoxId"`,
    );
    await queryRunner.query(`DROP TABLE "user_gacha_box"`);
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "gacha_box_id"`);
  }
}
