import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillItemSetRelations1758000001000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // If an old join table exists (item_set_items), copy its setId -> items.setId
    const hasJoin = await queryRunner.hasTable('item_set_items');
    if (!hasJoin) return;

    // Determine actual items table name. Some installs used singular 'item',
    // others used plural 'items'. Try both and pick the existing one.
    const itemsTable = (await queryRunner.hasTable('items'))
      ? 'items'
      : (await queryRunner.hasTable('item'))
        ? 'item'
        : null;
    if (!itemsTable) return; // nothing to do if items table doesn't exist

    // Use aggregate in case multiple rows exist per itemId: pick the MAX setId
    await queryRunner.query(`
      UPDATE "${itemsTable}"
      SET "setId" = sub."setId"
      FROM (
        SELECT "itemId", MAX("setId") as "setId"
        FROM item_set_items
        GROUP BY "itemId"
      ) sub
      WHERE "${itemsTable}".id = sub."itemId" AND ("${itemsTable}"."setId" IS NULL);
    `);

    // Note: do NOT drop the old join table automatically. Leaving it in place
    // makes the migration safe and reversible; admins can drop it after
    // verification if desired.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // If the join table exists, revert the above copy by nulling setId for
    // items that were present in the join table. If the join table no longer
    // exists, we cannot reliably recreate it here so down is a no-op.
    const hasJoin = await queryRunner.hasTable('item_set_items');
    if (!hasJoin) return;

    const itemsTable = (await queryRunner.hasTable('items'))
      ? 'items'
      : (await queryRunner.hasTable('item'))
        ? 'item'
        : null;
    if (!itemsTable) return;

    await queryRunner.query(`
      UPDATE "${itemsTable}"
      SET "setId" = NULL
      FROM (
        SELECT DISTINCT "itemId" FROM item_set_items
      ) sub
      WHERE "${itemsTable}".id = sub."itemId";
    `);
  }
}
