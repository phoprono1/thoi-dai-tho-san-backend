import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuildController } from './guild.controller';
import { GuildService } from './guild.service';
import { Guild, GuildMember, GuildEvent } from './guild.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Guild, GuildMember, GuildEvent, User])],
  controllers: [GuildController],
  providers: [GuildService],
  exports: [GuildService],
})
export class GuildModule {}
