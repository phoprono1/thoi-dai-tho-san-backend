import { Module } from '@nestjs/common';
import { MonsterModule } from '../monsters/monster.module';
import { DungeonsModule } from '../dungeons/dungeons.module';
import { ItemsModule } from '../items/items.module';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [MonsterModule, DungeonsModule, ItemsModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
