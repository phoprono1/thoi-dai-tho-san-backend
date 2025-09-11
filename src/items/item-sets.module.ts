import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemSetsService } from './item-sets.service';
import { ItemSetsController } from './item-sets.controller';
import { ItemSet } from './item-set.entity';
import { Item } from './item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ItemSet, Item])],
  controllers: [ItemSetsController],
  providers: [ItemSetsService],
  exports: [ItemSetsService],
})
export class ItemSetsModule {}
