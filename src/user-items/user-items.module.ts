import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserItemsController } from './user-items.controller';
import { UserItemsService } from './user-items.service';
import { UserItem } from './user-item.entity';
import { UpgradeLog } from './upgrade-log.entity';
import { User } from '../users/user.entity';
import { Item } from '../items/item.entity';
import { UserStatsModule } from '../user-stats/user-stats.module';
import { UsersModule } from '../users/users.module';
import { LevelsModule } from '../levels/levels.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserItem, UpgradeLog, User, Item]),
    UserStatsModule,
    UsersModule,
    LevelsModule,
  ],
  controllers: [UserItemsController],
  providers: [UserItemsService],
  exports: [UserItemsService],
})
export class UserItemsModule {}
