import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAttributesController } from './user-attributes.controller';
import { UserStatsModule } from '../user-stats/user-stats.module';
import { UserStat } from '../user-stats/user-stat.entity';
import { UserPowerService } from '../user-power/user-power.service';
import { UserPower } from '../user-power/user-power.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserStat, UserPower]), UserStatsModule],
  controllers: [UserAttributesController],
  providers: [UserPowerService],
  exports: [],
})
export class UserAttributesModule {}
