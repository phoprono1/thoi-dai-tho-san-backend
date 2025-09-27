/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { GuildController } from './guild.controller';
import { GuildService } from './guild.service';
import { GuildBuffController } from './guild-buff.controller';
import { GuildBuffService } from './guild-buff.service';
import { GlobalGuildBuffController } from './global-guild-buff.controller';
import { GlobalGuildBuffService } from './global-guild-buff.service';
import { Guild, GuildMember, GuildEvent } from './guild.entity';
import { GuildBuff } from './guild-buff.entity';
import { GlobalGuildBuff } from './global-guild-buff.entity';
import { User } from '../users/user.entity';
// dev-only controller
let DebugGuildController: any = undefined;
if (process.env.NODE_ENV !== 'production') {
  // require lazily to avoid including in prod bundle

  DebugGuildController = require('./debug.controller').DebugGuildController;
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Guild,
      GuildMember,
      GuildEvent,
      GuildBuff,
      GlobalGuildBuff,
      User,
    ]),
    CommonModule,
  ],
  controllers: [
    GuildController,
    GuildBuffController,
    GlobalGuildBuffController,
  ].concat(DebugGuildController ? [DebugGuildController] : []),
  providers: [GuildService, GuildBuffService, GlobalGuildBuffService],
  exports: [GuildService, GuildBuffService, GlobalGuildBuffService],
})
export class GuildModule {}
