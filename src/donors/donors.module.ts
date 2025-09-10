import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Donor } from './donor.entity';
import { DonorService } from './donor.service';
import { DonorController } from './donor.controller';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Donor, User])],
  controllers: [DonorController],
  providers: [DonorService],
  exports: [DonorService],
})
export class DonorsModule {}
