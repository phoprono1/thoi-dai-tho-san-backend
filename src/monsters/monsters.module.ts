import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Monster } from './monster.entity';
import { MonsterService } from './monster.service';
import { MonsterController } from './monster.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Monster])],
  providers: [MonsterService],
  controllers: [MonsterController],
  exports: [MonsterService, TypeOrmModule],
})
export class MonstersModule {}
