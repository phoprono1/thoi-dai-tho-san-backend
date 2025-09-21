import { DataSource } from 'typeorm';
import { AppDataSource } from '../src/data-source';
import { User } from '../src/users/user.entity';
import { UserStatsService } from '../src/user-stats/user-stats.service';

async function main() {
  const ds: DataSource = AppDataSource as unknown as DataSource;
  await ds.initialize();
  console.log('Connected to DB');

  const users = await ds.getRepository(User).find();
  console.log(`Found ${users.length} users`);

  // instantiate service manually using repository
  const userStatsRepo = ds.getRepository('UserStat');
  const userPowerRepo = ds.getRepository('UserPower');

  // Importing Nest services here is heavy; instead we'll run a small raw approach
  // but prefer to reuse existing recompute method via a lightweight Nest bootstrap if possible.

  console.log(
    'This script is a placeholder. Please run backfill via Nest CLI or ask me to implement a proper script that boots Nest and calls UserStatsService.recomputeAndPersistForUser for each user.',
  );

  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
