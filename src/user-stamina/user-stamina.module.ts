import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserStaminaService } from './user-stamina.service';
import { UserStaminaController } from './user-stamina.controller';
import { UserStamina } from './user-stamina.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserStamina]), CommonModule],
  controllers: [UserStaminaController],
  providers: [UserStaminaService],
  exports: [UserStaminaService],
})
export class UserStaminaModule {}
