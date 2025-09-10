import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DungeonsService } from './dungeons.service';
import { DungeonsController } from './dungeons.controller';
import { Dungeon } from './dungeon.entity';
import { User } from '../users/user.entity';
import { MonsterModule } from '../monsters/monster.module';

@Module({
  imports: [TypeOrmModule.forFeature([Dungeon, User]), MonsterModule],
  providers: [DungeonsService],
  controllers: [DungeonsController],
  exports: [DungeonsService],
})
export class DungeonsModule {}
