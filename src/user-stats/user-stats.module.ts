import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserStatsService } from './user-stats.service';
import { UserStatsController } from './user-stats.controller';
import { UserStat } from './user-stat.entity';
import { UserPowerModule } from '../user-power/user-power.module';
import { LevelsModule } from '../levels/levels.module';
import { UserItem } from '../user-items/user-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserStat, UserItem]),
    UserPowerModule,
    LevelsModule,
  ],
  providers: [UserStatsService],
  controllers: [UserStatsController],
  exports: [UserStatsService],
})
export class UserStatsModule {}
