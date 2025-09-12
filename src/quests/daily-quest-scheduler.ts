/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QuestService } from './quest.service';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class DailyQuestScheduler {
  private readonly logger = new Logger(DailyQuestScheduler.name);
  constructor(
    private readonly questService: QuestService,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  // Run at 00:05, 06:05, 12:05, and 18:05 server time to support 4 reset windows
  @Cron('5 0,6,12,18 * * *')
  async handleDailyReset() {
    this.logger.log('Starting daily quest reset');
    await this.runResetForAllUsers();
    this.logger.log('Daily quest reset complete');
  }

  // Test helper: runs every minute but only executes when environment flag
  // TEST_DAILY_RESET=true. This allows quick testing without changing the
  // scheduled production windows. Toggle by setting the env var and
  // restarting the backend.
  @Cron('* * * * *')
  async handleRapidReset() {
    if (process.env.TEST_DAILY_RESET !== 'true') return;
    this.logger.log(
      'Starting rapid (1m) daily quest reset (TEST_DAILY_RESET=true)',
    );
    await this.runResetForAllUsers();
    this.logger.log('Rapid daily quest reset complete');
  }

  // Shared implementation that processes users in batches.
  private async runResetForAllUsers(): Promise<void> {
    const batchSize = 200;
    let offset = 0;

    while (true) {
      const users = await this.userRepo.find({
        select: ['id'],
        skip: offset,
        take: batchSize,
      });
      if (!users || users.length === 0) break;

      await Promise.all(
        users.map(async (u) => {
          try {
            await this.questService.resetAllDailyQuestsForUser(u.id);
          } catch (err) {
            this.logger.error(`Failed reset for user ${u.id}: ${err}`);
          }
        }),
      );

      offset += users.length;
    }
  }
}
