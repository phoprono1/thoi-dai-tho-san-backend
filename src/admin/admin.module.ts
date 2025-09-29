import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminResourcesController } from './admin-resources.controller';
import { AdminService } from './admin.service';
import { UserStatsModule } from '../user-stats/user-stats.module';
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
    TypeOrmModule.forFeature([
      User,
      UserStat,
      Dungeon,
      Quest,
      Item,
      CharacterClassHistory,
    ]),
  ],
  controllers: [AdminController, AdminResourcesController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
