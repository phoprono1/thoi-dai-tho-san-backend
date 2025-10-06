import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { redisProvider } from './redis.provider';
import { IpTrackingService } from './services/ip-tracking.service';
import { BehavioralAnalysisService } from './services/behavioral-analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [redisProvider, IpTrackingService, BehavioralAnalysisService],
  exports: [redisProvider, IpTrackingService, BehavioralAnalysisService],
})
export class CommonModule {}
