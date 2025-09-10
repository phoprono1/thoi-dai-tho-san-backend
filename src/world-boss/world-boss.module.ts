import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorldBossController } from './world-boss.controller';
import { WorldBossService } from './world-boss.service';
import { WorldBossGateway } from './world-boss.gateway';
import { WorldBoss } from './world-boss.entity';
import { BossCombatLog } from './boss-combat-log.entity';
import { BossDamageRanking } from './boss-damage-ranking.entity';
import { UsersModule } from '../users/users.module';
import { UserStatsModule } from '../user-stats/user-stats.module';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import { Mailbox } from '../mailbox/mailbox.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorldBoss,
      BossCombatLog,
      BossDamageRanking,
      User,
      UserStat,
      Mailbox,
    ]),
    UsersModule,
    UserStatsModule,
  ],
  controllers: [WorldBossController],
  providers: [WorldBossService, WorldBossGateway],
  exports: [WorldBossService, WorldBossGateway],
})
export class WorldBossModule {}
