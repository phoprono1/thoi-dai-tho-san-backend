import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PvpController } from './pvp.controller';
import { PvpService } from './pvp.service';
import { PvpMatch, PvpPlayer } from './pvp.entity';
import { PvpRankingController } from './pvp-ranking.controller';
import { PvpAdminController } from './pvp-admin.controller';
import { PvpRankingService } from './pvp-ranking.service';
import { PvpRanking, PvpSeason, PvpMatch as PvpMatchNew } from './entities';
import { User } from '../users/user.entity';
import { CombatResultsModule } from '../combat-results/combat-results.module';
import { UserStatsModule } from '../user-stats/user-stats.module';
import { MailboxModule } from '../mailbox/mailbox.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Old PvP entities (keep for backward compatibility)
      PvpMatch,
      PvpPlayer,
      // New PvP ranking entities
      PvpRanking,
      PvpSeason,
      PvpMatchNew,
      User,
    ]),
    CombatResultsModule,
    UserStatsModule,
    MailboxModule,
  ],
  controllers: [
    PvpController, // Old controller (keep for backward compatibility)
    PvpRankingController, // New ranking controller
    PvpAdminController, // Admin controller
  ],
  providers: [
    PvpService, // Old service (keep for backward compatibility)
    PvpRankingService, // New ranking service
  ],
  exports: [PvpService, PvpRankingService],
})
export class PvpModule {}
