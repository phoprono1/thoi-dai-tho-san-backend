/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyLoginConfig } from './daily-login-config.entity';
import { DailyLoginRecord } from './daily-login-record.entity';
import { User } from '../users/user.entity';
import { MailboxService } from '../mailbox/mailbox.service';
import { MailType } from '../mailbox/mailbox.entity';

export type DailyLoginMetadata = {
  dailyRewards: {
    day: number;
    rewards: {
      gold?: number;
      items?: { itemId: number; quantity: number }[];
      exp?: number;
    };
  }[];
  streakRewards: {
    streak: number;
    rewards: {
      gold?: number;
      items?: { itemId: number; quantity: number }[];
      exp?: number;
    };
  }[];
};

@Injectable()
export class DailyLoginService {
  constructor(
    @InjectRepository(DailyLoginConfig)
    private configRepository: Repository<DailyLoginConfig>,
    @InjectRepository(DailyLoginRecord)
    private recordRepository: Repository<DailyLoginRecord>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly mailboxService: MailboxService,
  ) {}

  async getCurrentConfig(
    year: number,
    month: number,
  ): Promise<DailyLoginConfig | null> {
    const config = await this.configRepository.findOne({
      where: { year, month, enabled: true },
    });

    return config || null;
  }

  async getUserLoginRecord(
    userId: number,
    date: Date,
  ): Promise<DailyLoginRecord | null> {
    const loginDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    return this.recordRepository.findOne({
      where: { userId, loginDate },
    });
  }

  async getUserStreak(userId: number): Promise<number> {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayRecord = await this.getUserLoginRecord(userId, today);
    const yesterdayRecord = await this.getUserLoginRecord(userId, yesterday);

    if (todayRecord?.claimed) {
      return todayRecord.streakCount;
    } else if (yesterdayRecord?.claimed) {
      return yesterdayRecord.streakCount;
    }

    return 0;
  }

  async canClaimToday(userId: number): Promise<boolean> {
    const today = new Date();
    const record = await this.getUserLoginRecord(userId, today);
    return !record?.claimed;
  }

  async claimDailyReward(
    userId: number,
  ): Promise<{ rewards: any; streakCount: number }> {
    const today = new Date();
    const canClaim = await this.canClaimToday(userId);

    if (!canClaim) {
      throw new Error('Already claimed daily reward today');
    }

    const currentStreak = await this.getUserStreak(userId);
    const newStreak = currentStreak + 1;

    // Get current config
    const config = await this.getCurrentConfig(
      today.getFullYear(),
      today.getMonth() + 1,
    );

    // Calculate rewards
    const dailyRewards = config.metadata?.dailyRewards || [];
    const streakRewards = config.metadata?.streakRewards || [];

    const dayOfMonth = today.getDate();
    const dailyReward = dailyRewards[dayOfMonth - 1] || {};
    const streakReward =
      streakRewards.find((r) => r.streak === newStreak) || {};

    const rewards = {
      ...dailyReward,
      ...streakReward,
    };

    // Create or update record
    const loginDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    let record = await this.recordRepository.findOne({
      where: { userId, loginDate },
    });

    if (record) {
      record.claimed = true;
      record.streakCount = newStreak;
      record.rewards = rewards;
    } else {
      record = this.recordRepository.create({
        userId,
        loginDate,
        streakCount: newStreak,
        claimed: true,
        rewards,
      });
    }

    await this.recordRepository.save(record);

    // Send rewards to mailbox
    const dayOfMonthFormatted = today.getDate();
    const monthFormatted = today.getMonth() + 1;
    const yearFormatted = today.getFullYear();

    const combinedRewards: any = {
      gold:
        (dailyReward as any)?.rewards?.gold ||
        (streakReward as any)?.rewards?.gold,
      exp:
        (dailyReward as any)?.rewards?.exp ||
        (streakReward as any)?.rewards?.exp,
      items: [
        ...((dailyReward as any)?.rewards?.items || []),
        ...((streakReward as any)?.rewards?.items || []),
      ].filter((item: any) => item),
    };

    await this.mailboxService.sendMail({
      userId,
      title: `Phần thưởng đăng nhập ${dayOfMonthFormatted}/${monthFormatted}/${yearFormatted}`,
      content: `Chúc mừng bạn đã nhận được phần thưởng đăng nhập hằng ngày! Chuỗi đăng nhập: ${newStreak} ngày.`,
      type: MailType.SYSTEM,
      rewards: {
        gold: combinedRewards.gold,
        experience: combinedRewards.exp,
        items:
          combinedRewards.items?.length > 0 ? combinedRewards.items : undefined,
      },
    });

    return { rewards, streakCount: newStreak };
  }

  async getUserLoginHistory(
    userId: number,
    limit: number = 30,
  ): Promise<DailyLoginRecord[]> {
    return this.recordRepository.find({
      where: { userId },
      order: { loginDate: 'DESC' },
      take: limit,
    });
  }

  // Admin methods
  async createOrUpdateConfig(
    year: number,
    month: number,
    metadata: DailyLoginMetadata,
    enabled: boolean = true,
  ): Promise<DailyLoginConfig> {
    let config = await this.configRepository.findOne({
      where: { year, month },
    });

    if (config) {
      config.metadata = metadata;
      config.enabled = enabled;
    } else {
      config = this.configRepository.create({
        year,
        month,
        enabled,
        metadata,
      });
    }

    return this.configRepository.save(config);
  }

  async getAllConfigs(): Promise<DailyLoginConfig[]> {
    return this.configRepository.find({
      order: { year: 'DESC', month: 'DESC' },
    });
  }
}
