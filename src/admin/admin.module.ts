import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { UserStatsModule } from '../user-stats/user-stats.module';

@Module({
  imports: [UserStatsModule],
  controllers: [AdminController],
})
export class AdminModule {}
