import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPower } from './user-power.entity';
import { UserPowerService } from './user-power.service';
import { UserPowerController } from './user-power.controller';
import { UserPowerLeaderboardController } from './user-power.leaderboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserPower])],
  providers: [UserPowerService],
  controllers: [UserPowerController, UserPowerLeaderboardController],
  exports: [UserPowerService],
})
export class UserPowerModule {}
