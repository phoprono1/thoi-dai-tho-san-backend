import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { CommonModule } from '../common/common.module';
import { HealScheduler } from './heal-scheduler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserStatsModule } from 'src/user-stats/user-stats.module';
import { UserStat } from 'src/user-stats/user-stat.entity';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([UserStat]),
    UserStatsModule,
  ],
  providers: [HealthService, HealScheduler],
  controllers: [HealthController],
})
export class HealthModule {}
