import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestService } from './quest.service';
import { QuestController } from './quest.controller';
import { Quest, UserQuest, QuestCombatTracking } from './quest.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quest, UserQuest, QuestCombatTracking, User]),
  ],
  controllers: [QuestController],
  providers: [QuestService],
  exports: [QuestService],
})
export class QuestModule {}
