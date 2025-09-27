import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CraftingController } from './crafting.controller';
import { CraftingService } from './crafting.service';
import { CraftingRecipe } from './crafting-recipe.entity';
import { Item } from '../items/item.entity';
import { UserItem } from '../user-items/user-item.entity';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CraftingRecipe, Item, UserItem, User, UserStat]),
  ],
  controllers: [CraftingController],
  providers: [CraftingService],
  exports: [CraftingService],
})
export class CraftingModule {}
