import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PvpController } from './pvp.controller';
import { PvpService } from './pvp.service';
import { PvpMatch, PvpPlayer } from './pvp.entity';
import { User } from '../users/user.entity';
import { CombatResultsModule } from '../combat-results/combat-results.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PvpMatch, PvpPlayer, User]),
    CombatResultsModule,
  ],
  controllers: [PvpController],
  providers: [PvpService],
  exports: [PvpService],
})
export class PvpModule {}
