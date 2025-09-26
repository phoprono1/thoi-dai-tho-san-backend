import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BossSchedule, DayOfWeek } from './boss-schedule.entity';
import { WorldBoss, BossStatus, BossDisplayMode } from './world-boss.entity';
import { WorldBossService } from './world-boss.service';

@Injectable()
export class BossSchedulerService {
  private readonly logger = new Logger(BossSchedulerService.name);

  constructor(
    @InjectRepository(BossSchedule)
    private bossScheduleRepository: Repository<BossSchedule>,
    @InjectRepository(WorldBoss)
    private worldBossRepository: Repository<WorldBoss>,
    private worldBossService: WorldBossService,
  ) {}

  @Cron('0 * * * *') // Check every hour
  async checkScheduledBosses() {
    this.logger.log('Checking for scheduled bosses...');

    try {
      const now = new Date();
      const vietnamTime = new Date(
        now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }),
      );

      const dayOfWeek = this.getDayOfWeek(vietnamTime);
      const currentTime = this.formatTime(vietnamTime);

      this.logger.log(
        `Current Vietnam time: ${vietnamTime.toISOString()}, Day: ${dayOfWeek}, Time: ${currentTime}`,
      );

      const scheduledBosses = await this.bossScheduleRepository.find({
        where: {
          dayOfWeek,
          isActive: true,
        },
      });

      for (const schedule of scheduledBosses) {
        if (await this.shouldSpawnBoss(schedule, currentTime, vietnamTime)) {
          await this.spawnScheduledBoss(schedule, vietnamTime);
        }
      }
    } catch (error) {
      this.logger.error('Error checking scheduled bosses:', error);
    }
  }

  private getDayOfWeek(date: Date): DayOfWeek {
    const days = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    return days[date.getDay()] as DayOfWeek;
  }

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 8); // HH:MM:SS
  }

  private async shouldSpawnBoss(
    schedule: BossSchedule,
    currentTime: string,
    now: Date,
  ): Promise<boolean> {
    // Check if current time matches schedule start time (within 1 hour window)
    const scheduleHour = parseInt(schedule.startTime.split(':')[0]);
    const currentHour = now.getHours();

    if (scheduleHour !== currentHour) {
      return false;
    }

    // Check if boss already exists for this schedule today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const existingBoss = await this.worldBossRepository.findOne({
      where: {
        scheduleId: schedule.id,
        createdAt: {
          $gte: todayStart,
          $lte: todayEnd,
        } as any,
      },
    });

    return !existingBoss;
  }

  private async spawnScheduledBoss(
    schedule: BossSchedule,
    spawnTime: Date,
  ): Promise<void> {
    this.logger.log(`Spawning scheduled boss: ${schedule.name}`);

    try {
      const template = schedule.bossTemplate;
      const endTime = new Date(spawnTime);
      endTime.setMinutes(endTime.getMinutes() + schedule.durationMinutes);

      const boss = this.worldBossRepository.create({
        name: template.name,
        description: template.description,
        maxHp: 999999999, // High HP for damage bar mode
        currentHp: 999999999,
        level: template.level,
        stats: template.stats,
        status: BossStatus.ALIVE,
        displayMode: BossDisplayMode.DAMAGE_BAR,
        spawnCount: 1,
        durationMinutes: schedule.durationMinutes,
        endTime,
        scheduledStartTime: spawnTime,
        scheduleId: schedule.id,
        scalingConfig: {
          hpMultiplier: 1.2,
          statMultiplier: 1.15,
          rewardMultiplier: 1.1,
          maxSpawnCount: 10,
        },
        damagePhases: {
          phase1Threshold: template.damagePhases.phase1Threshold,
          phase2Threshold: template.damagePhases.phase2Threshold,
          phase3Threshold: template.damagePhases.phase3Threshold,
          currentPhase: 1,
          totalDamageReceived: 0,
        },
        rewards: template.rewards,
        maxCombatTurns: 50,
        image: template.image, // Add image from template
      });

      const savedBoss = await this.worldBossRepository.save(boss);

      // Start boss timer
      this.startBossTimer(savedBoss.id, schedule.durationMinutes);

      this.logger.log(
        `Successfully spawned boss: ${savedBoss.name} (ID: ${savedBoss.id})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to spawn scheduled boss: ${schedule.name}`,
        error,
      );
    }
  }

  private startBossTimer(bossId: number, durationMinutes: number) {
    const timer = setTimeout(
      async () => {
        await this.handleBossTimeout(bossId);
      },
      durationMinutes * 60 * 1000,
    );

    // Store timer reference if needed for cleanup
    // this.bossTimers.set(bossId, timer);
  }

  private async handleBossTimeout(bossId: number) {
    this.logger.log(
      `Boss ${bossId} timeout - ending event and distributing rewards`,
    );

    try {
      const boss = await this.worldBossRepository.findOne({
        where: { id: bossId },
      });

      if (!boss || boss.status !== BossStatus.ALIVE) {
        return;
      }

      // End boss event and distribute rewards
      await this.worldBossService.endBossEvent(boss);

      this.logger.log(`Boss ${bossId} event ended successfully`);
    } catch (error) {
      this.logger.error(
        `Error handling boss timeout for boss ${bossId}:`,
        error,
      );
    }
  }

  // Admin methods
  async createSchedule(
    scheduleData: Partial<BossSchedule>,
  ): Promise<BossSchedule> {
    const schedule = this.bossScheduleRepository.create(scheduleData);
    return await this.bossScheduleRepository.save(schedule);
  }

  async updateSchedule(
    id: number,
    scheduleData: Partial<BossSchedule>,
  ): Promise<BossSchedule> {
    await this.bossScheduleRepository.update(id, scheduleData);
    const updated = await this.bossScheduleRepository.findOne({
      where: { id },
    });
    if (!updated) {
      throw new Error('Schedule not found');
    }
    return updated;
  }

  async deleteSchedule(id: number): Promise<void> {
    await this.bossScheduleRepository.delete(id);
  }

  async getAllSchedules(): Promise<BossSchedule[]> {
    return await this.bossScheduleRepository.find({
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async getActiveSchedules(): Promise<BossSchedule[]> {
    return await this.bossScheduleRepository.find({
      where: { isActive: true },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }
}
