import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserStatsService } from './user-stats.service';
import { UserStatsController } from './user-stats.controller';
import { UserStat } from './user-stat.entity';
import { UserPowerModule } from '../user-power/user-power.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserStat]), UserPowerModule],
  providers: [UserStatsService],
  controllers: [UserStatsController],
  exports: [UserStatsService],
})
export class UserStatsModule {}
