import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorldBossController } from './world-boss.controller';
import { WorldBossService } from './world-boss.service';
import { BossSchedulerService } from './boss-scheduler.service';
import { BossTemplateService } from './boss-template.service';
import { WorldBossGateway } from './world-boss.gateway';
import { WorldBoss } from './world-boss.entity';
import { BossCombatLog } from './boss-combat-log.entity';
import { BossDamageRanking } from './boss-damage-ranking.entity';
import { BossCombatCooldown } from './boss-combat-cooldown.entity';
import { BossSchedule } from './boss-schedule.entity';
import { BossTemplate } from './boss-template.entity';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import { Guild } from '../guild/guild.entity';
import { Mailbox } from '../mailbox/mailbox.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorldBoss,
      BossCombatLog,
      BossDamageRanking,
      BossCombatCooldown,
      BossSchedule,
      BossTemplate,
      User,
      UserStat,
      Guild,
      Mailbox,
    ]),
  ],
  controllers: [WorldBossController],
  providers: [
    WorldBossService,
    BossSchedulerService,
    BossTemplateService,
    WorldBossGateway,
    {
      provide: 'GATEWAY_SETUP',
      useFactory: (service: WorldBossService, gateway: WorldBossGateway) => {
        service.setGateway(gateway);
        return true;
      },
      inject: [WorldBossService, WorldBossGateway],
    },
  ],
  exports: [
    WorldBossService,
    BossSchedulerService,
    BossTemplateService,
    WorldBossGateway,
  ],
})
export class WorldBossModule {}
