import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GachaBox } from './gacha-box.entity';
import { GachaBoxEntry } from './gacha-box-entry.entity';
import { GachaBoxOpenLog } from './gacha-box-open-log.entity';
import { GachaService } from './gacha.service';
import { GachaController } from './gacha.controller';
import { UserGachaBoxService } from './user-gacha-box.service';
import { UserGachaBox } from './user-gacha-box.entity';
import { UserGachaBoxController } from './user-gacha-box.controller';
import { UserItemsModule } from '../user-items/user-items.module';
import { UserItem } from '../user-items/user-item.entity';
import { Item } from '../items/item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GachaBox,
      GachaBoxEntry,
      GachaBoxOpenLog,
      UserGachaBox,
      UserItem,
      Item,
    ]),
    UserItemsModule,
  ],
  providers: [GachaService, UserGachaBoxService],
  controllers: [GachaController, UserGachaBoxController],
  exports: [GachaService],
})
export class GachaModule {}
