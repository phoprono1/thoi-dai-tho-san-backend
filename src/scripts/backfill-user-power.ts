/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { AppDataSource } from '../data-source';
import { User } from '../users/user.entity';
import { UserPowerService } from '../user-power/user-power.service';

async function main() {
  await AppDataSource.initialize();
  const svc = new UserPowerService(
    AppDataSource.getRepository('user_power'),
    AppDataSource,
  ) as any;
  // svc.backfillAll exists on instance when properly wired via Nest; here we call compute directly
  const users = await AppDataSource.manager.find(User, { take: 100 });
  for (const u of users) {
    try {
      // Use raw SQL for compute? For now call service method if available
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await svc.computeAndSaveForUser(u.id);
      console.log('Updated user', u.id);
    } catch (err) {
      console.warn('Failed', u.id, err.message || err);
    }
  }
  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
