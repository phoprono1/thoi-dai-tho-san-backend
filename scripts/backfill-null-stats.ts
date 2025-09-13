import { AppDataSource } from '../src/data-source';
import { Item } from '../src/items/item.entity';

async function main() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const repo = AppDataSource.getRepository(Item);
    const items = await repo.find();
    let updated = 0;
    for (const it of items) {
      if (it.stats === null || it.stats === undefined) {
        it.stats = {};
        await repo.save(it);
        updated++;
      }
    }
    console.log(`Backfill complete. Updated ${updated} items.`);
    process.exit(0);
  } catch (e) {
    console.error('Backfill failed', e);
    process.exit(1);
  }
}

main();
