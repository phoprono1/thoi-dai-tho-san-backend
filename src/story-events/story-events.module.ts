import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoryEventsService } from './story-events.service';
import { StoryEventsController } from './story-events.controller';
import { StoryEvent } from './story-event.entity';
import { StoryEventUserContrib } from './story-event-user-contrib.entity';
import { StoryEventGlobal } from './story-event-global.entity';
import { StoryEventCombatTracking } from './story-event-combat-tracking.entity';
import { CombatResult } from '../combat-results/combat-result.entity';
import { MailboxModule } from '../mailbox/mailbox.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StoryEvent,
      StoryEventUserContrib,
      StoryEventGlobal,
      StoryEventCombatTracking,
      CombatResult,
    ]),
    MailboxModule,
  ],
  providers: [StoryEventsService],
  controllers: [StoryEventsController],
  exports: [StoryEventsService],
})
export class StoryEventsModule {}
