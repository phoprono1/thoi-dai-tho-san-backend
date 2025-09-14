import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { MarketScheduler } from './market-scheduler';
import { ShopItem } from './shop-item.entity';
import { MarketListing } from './market-listing.entity';
import { MarketOffer } from './market-offer.entity';
import { PurchaseHistory } from './purchase-history.entity';
import { Escrow } from './escrow.entity';
import { UsersModule } from '../users/users.module';
import { UserItemsModule } from '../user-items/user-items.module';
import { MailboxModule } from '../mailbox/mailbox.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShopItem,
      MarketListing,
      MarketOffer,
      PurchaseHistory,
      Escrow,
    ]),
    UsersModule,
    UserItemsModule,
    MailboxModule,
  ],
  providers: [MarketService, MarketScheduler],
  controllers: [MarketController],
  exports: [MarketService],
})
export class MarketModule {}
