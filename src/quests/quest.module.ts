import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestService } from './quest.service';
import { QuestController } from './quest.controller';
import { Quest, UserQuest, QuestCombatTracking } from './quest.entity';
import { CombatResult } from '../combat-results/combat-result.entity';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { UserItemsModule } from '../user-items/user-items.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quest,
      UserQuest,
      QuestCombatTracking,
      CombatResult,
      User,
    ]),
    UsersModule,
    UserItemsModule,
  ],
  controllers: [QuestController],
  providers: [QuestService],
  exports: [QuestService],
})
export class QuestModule {}
