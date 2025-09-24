import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserStatsService } from './user-stats.service';
import { UserStatsController } from './user-stats.controller';
import { UserStat } from './user-stat.entity';
import { UserPowerModule } from '../user-power/user-power.module';
import { LevelsModule } from '../levels/levels.module';
import { UserItem } from '../user-items/user-item.entity';
import { User } from '../users/user.entity';
import { UserItemsModule } from '../user-items/user-items.module';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserStat, UserItem, User]),
    UserPowerModule,
    LevelsModule,
    forwardRef(() => UserItemsModule),
    ItemsModule,
  ],
  providers: [UserStatsService],
  controllers: [UserStatsController],
  exports: [UserStatsService],
})
export class UserStatsModule {}
