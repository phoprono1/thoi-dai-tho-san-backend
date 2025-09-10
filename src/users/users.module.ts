import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { LevelsModule } from '../levels/levels.module';
import { UserStatsModule } from '../user-stats/user-stats.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), LevelsModule, UserStatsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
