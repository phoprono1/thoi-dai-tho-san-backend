import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminResourcesController } from './admin-resources.controller';
import { AdminSecurityController } from './admin-security.controller';
import { AdminService } from './admin.service';
import { UserStatsModule } from '../user-stats/user-stats.module';
import { UsersModule } from '../users/users.module';
import { CommonModule } from '../common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import { Dungeon } from '../dungeons/dungeon.entity';
import { Quest } from '../quests/quest.entity';
import { Item } from '../items/item.entity';
import { CharacterClassHistory } from '../character-classes/character-class-history.entity';

@Module({
  imports: [
    UserStatsModule,
    UsersModule,
    CommonModule,
    TypeOrmModule.forFeature([
      User,
      UserStat,
      Dungeon,
      Quest,
      Item,
      CharacterClassHistory,
    ]),
  ],
  controllers: [
    AdminController,
    AdminResourcesController,
    AdminSecurityController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
