import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { ItemSetsController } from './item-sets.controller';
import { ItemSetsService } from './item-sets.service';
import { Item } from './item.entity';
import { ItemSet } from './item-set.entity';
import { UserItem } from '../user-items/user-item.entity';
import { UserItemsModule } from '../user-items/user-items.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Item, ItemSet, UserItem]),
    UserItemsModule,
  ],
  controllers: [ItemsController, ItemSetsController],
  providers: [ItemsService, ItemSetsService],
  exports: [ItemsService, ItemSetsService],
})
export class ItemsModule {}
