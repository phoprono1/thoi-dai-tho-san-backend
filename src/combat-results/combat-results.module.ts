import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CombatResultsService } from './combat-results.service';
import { CombatResultsController } from './combat-results.controller';
import { CombatResult } from './combat-result.entity';
import { CombatLog } from './combat-log.entity';
import { User } from '../users/user.entity';
import { Dungeon } from '../dungeons/dungeon.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import { UsersModule } from '../users/users.module';
import { DungeonsModule } from '../dungeons/dungeons.module';
import { UserStatsModule } from '../user-stats/user-stats.module';
import { UserItemsModule } from '../user-items/user-items.module';
import { LevelsModule } from '../levels/levels.module';
import { UserStaminaModule } from '../user-stamina/user-stamina.module';
import { Monster } from '../monsters/monster.entity';
import { MonstersModule } from '../monsters/monsters.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CombatResult,
      CombatLog,
      User,
      Dungeon,
      UserStat,
      Monster,
    ]),
    UsersModule,
    DungeonsModule,
    UserStatsModule,
    UserItemsModule,
    LevelsModule,
    UserStaminaModule,
    MonstersModule,
  ],
  providers: [CombatResultsService],
  controllers: [CombatResultsController],
  exports: [CombatResultsService],
})
export class CombatResultsModule {}
