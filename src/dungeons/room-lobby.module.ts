import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomLobbyController } from './room-lobby.controller';
import { RoomLobbyService } from './room-lobby.service';
import { RoomLobbyGateway } from './room-lobby.gateway';
import { RoomLobby, RoomPlayer } from './room-lobby.entity';
import { CombatResultsModule } from '../combat-results/combat-results.module';
import { UsersModule } from '../users/users.module';
import { DungeonsModule } from './dungeons.module';
import { User } from '../users/user.entity';
import { Dungeon } from './dungeon.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoomLobby, RoomPlayer, User, Dungeon]),
    CombatResultsModule,
    UsersModule,
    DungeonsModule,
    CommonModule,
  ],
  controllers: [RoomLobbyController],
  providers: [RoomLobbyService, RoomLobbyGateway],
  exports: [RoomLobbyService],
})
export class RoomLobbyModule {}
