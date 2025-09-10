import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CharacterClassController } from './character-class.controller';
import { CharacterClassService } from './character-class.service';
import { CharacterClass, CharacterAdvancement } from './character-class.entity';
import { UsersModule } from '../users/users.module';
import { UserStatsModule } from '../user-stats/user-stats.module';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import { CombatResult } from '../combat-results/combat-result.entity';
import { UserItem } from '../user-items/user-item.entity';
import { QuestModule } from '../quests/quest.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CharacterClass,
      CharacterAdvancement,
      User,
      UserStat,
      CombatResult,
      UserItem,
    ]),
    UsersModule,
    UserStatsModule,
    QuestModule,
  ],
  controllers: [CharacterClassController],
  providers: [CharacterClassService],
  exports: [CharacterClassService],
})
export class CharacterClassesModule {}
