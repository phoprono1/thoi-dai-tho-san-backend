import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UserStatsService } from '../src/user-stats/user-stats.service';
import { UsersService } from '../src/users/users.service';

async function backfillUserStats() {
  console.log('Starting backfill of user stats...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const userStatsService = app.get(UserStatsService);
  const usersService = app.get(UsersService);

  // Get all users
  const users = await usersService.findAll();
  console.log(`Found ${users.length} users to backfill`);

  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      console.log(`Ensuring stats exist for user ${user.id} (${user.username})`);
      const existingStats = await userStatsService.findByUserId(user.id);
      if (!existingStats) {
        await userStatsService.createForUser(user.id);
        console.log(`Created default stats for user ${user.id}`);
      } else {
        console.log(`Stats already exist for user ${user.id}`);
      }
      successCount++;
    } catch (error) {
      console.error(`Failed to ensure stats for user ${user.id}:`, error);
      errorCount++;
    }
  }

  console.log(
    `Backfill completed: ${successCount} successful, ${errorCount} errors`,
  );
  await app.close();
}

backfillUserStats().catch(console.error);
