import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WildAreaMonster } from './wildarea.entity';
import { WildAreaService } from './wildarea.service';
import { WildAreaController } from './wildarea.controller';
import { Monster } from '../monsters/monster.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WildAreaMonster, Monster])],
  providers: [WildAreaService],
  controllers: [WildAreaController],
  exports: [WildAreaService],
})
export class WildAreaModule {}
