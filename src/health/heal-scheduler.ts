import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStat } from '../user-stats/user-stat.entity';
import { UserStatsService } from '../user-stats/user-stats.service';
import { deriveCombatStats } from '../combat-engine/stat-converter';

@Injectable()
export class HealScheduler {
  private readonly logger = new Logger(HealScheduler.name);
  constructor(
    @InjectRepository(UserStat) private userStatRepo: Repository<UserStat>,
    private readonly userStatsService: UserStatsService,
  ) {}

  // Production: mỗi 5 phút hồi 10% máu cho tất cả user chưa đầy máu
  @Cron('*/5 * * * *')
  async handleScheduledHeal() {
    this.logger.log('Starting scheduled heal for all users');
    await this.healAllUsers();
    this.logger.log('Scheduled heal complete');
  }

  // Production: mỗi 5 phút hồi 10% máu
  // @Cron('*/5 * * * *')
  // async handleScheduledHeal() {
  //   this.logger.log('Starting scheduled heal for all users');
  //   await this.healAllUsers();
  //   this.logger.log('Scheduled heal complete');
  // }

  private async healAllUsers(): Promise<void> {
    const batchSize = 200;
    let offset = 0;

    while (true) {
      const userStatsBatch = await this.userStatRepo.find({
        select: [
          'id',
          'userId',
          'currentHp',
          'strength',
          'intelligence',
          'dexterity',
          'vitality',
          'luck',
          'strengthPoints',
          'intelligencePoints',
          'dexterityPoints',
          'vitalityPoints',
          'luckPoints',
        ],
        skip: offset,
        take: batchSize,
      });
      if (!userStatsBatch || userStatsBatch.length === 0) break;

      await Promise.all(
        userStatsBatch.map(async (userStat) => {
          try {
            // Tính tổng stat (bao gồm bonus, trang bị, v.v.)
            const totalStats =
              await this.userStatsService.getTotalStatsWithAllBonuses(
                userStat.userId,
              );
            // Tính maxHp động
            const combatStats = deriveCombatStats({
              baseMaxHp: 100,
              strength: totalStats.str,
              intelligence: totalStats.int,
              dexterity: totalStats.dex,
              vitality: totalStats.vit,
              luck: totalStats.luk,
            });
            const maxHp = combatStats.maxHp;
            if (userStat.currentHp < maxHp) {
              const healAmount = Math.floor(maxHp * 0.1);
              const newHp = Math.min(userStat.currentHp + healAmount, maxHp);
              await this.userStatRepo.update(userStat.id, { currentHp: newHp });
            }
          } catch (err) {
            this.logger.error(
              `Failed heal for userStat ${userStat.id}: ${err}`,
            );
          }
        }),
      );

      offset += userStatsBatch.length;
    }
  }
}
