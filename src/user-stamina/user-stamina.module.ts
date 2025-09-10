import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserStaminaService } from './user-stamina.service';
import { UserStaminaController } from './user-stamina.controller';
import { UserStamina } from './user-stamina.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserStamina])],
  controllers: [UserStaminaController],
  providers: [UserStaminaService],
  exports: [UserStaminaService],
})
export class UserStaminaModule {}
