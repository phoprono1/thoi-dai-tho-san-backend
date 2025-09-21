import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CharacterClassController } from './character-class.controller';
import { MappingsController } from './mappings.controller';
import { CharacterClassService } from './character-class.service';
import { AdvancementService } from './advancement.service';
import { CharacterClass, CharacterAdvancement } from './character-class.entity';
import { CharacterClassAdvancement } from './character-class-advancement.entity';
import { CharacterClassHistory } from './character-class-history.entity';
import { PendingAdvancement } from './pending-advancement.entity';
import { UsersModule } from '../users/users.module';
import { UserStatsModule } from '../user-stats/user-stats.module';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import { CombatResult } from '../combat-results/combat-result.entity';
import { UserItem } from '../user-items/user-item.entity';
import { QuestModule } from '../quests/quest.module';
import { MailboxModule } from '../mailbox/mailbox.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CharacterClass,
      CharacterAdvancement,
      // New entities for advancement mappings and history
      // (tables will be created via migration)
      CharacterClassAdvancement,
      CharacterClassHistory,
      // Pending advancement records
      PendingAdvancement,
      User,
      UserStat,
      CombatResult,
      UserItem,
    ]),
    UsersModule,
    UserStatsModule,
    QuestModule,
    MailboxModule,
    EventsModule,
  ],
  controllers: [CharacterClassController, MappingsController],
  providers: [CharacterClassService, AdvancementService],
  exports: [CharacterClassService, AdvancementService],
})
export class CharacterClassesModule {}
