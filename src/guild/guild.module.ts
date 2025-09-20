/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { GuildController } from './guild.controller';
import { GuildService } from './guild.service';
import { Guild, GuildMember, GuildEvent } from './guild.entity';
import { User } from '../users/user.entity';
// dev-only controller
let DebugGuildController: any = undefined;
if (process.env.NODE_ENV !== 'production') {
  // require lazily to avoid including in prod bundle

  DebugGuildController = require('./debug.controller').DebugGuildController;
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Guild, GuildMember, GuildEvent, User]),
    CommonModule,
  ],
  controllers: [GuildController].concat(
    DebugGuildController ? [DebugGuildController] : [],
  ),
  providers: [GuildService],
  exports: [GuildService],
})
export class GuildModule {}
