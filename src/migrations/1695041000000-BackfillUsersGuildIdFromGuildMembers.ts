import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillUsersGuildIdFromGuildMembers1695041000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Set user.guildId for users that have an approved guild_members row but no guildId set
    // Only set when the referenced guild actually exists to avoid FK violations
    await queryRunner.query(
      `UPDATE "user" u
       SET "guildId" = gm."guildId"
       FROM guild_members gm
       WHERE gm."userId" = u.id
         AND gm."isApproved" = true
         AND u."guildId" IS NULL
         AND EXISTS (SELECT 1 FROM "guild" g WHERE g.id = gm."guildId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse: clear guildId for users whose guildId matches an approved guild_members row
    // Also ensure the guild exists (safe no-op otherwise)
    await queryRunner.query(
      `UPDATE "user" u
       SET "guildId" = NULL
       FROM guild_members gm
       WHERE gm."userId" = u.id
         AND gm."isApproved" = true
         AND u."guildId" = gm."guildId"
         AND EXISTS (SELECT 1 FROM "guild" g WHERE g.id = gm."guildId")`,
    );
  }
}
