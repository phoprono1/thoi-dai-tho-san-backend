import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserStatsModule } from '../user-stats/user-stats.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';

@Module({
  imports: [UserStatsModule, TypeOrmModule.forFeature([User, UserStat])],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
