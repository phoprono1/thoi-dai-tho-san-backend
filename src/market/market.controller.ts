// market controller: use typed CurrentUser decorator
import {
  Controller,
  Post,
  Body,
  Request,
  Param,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
  Get,
  Delete,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { MarketService } from './market.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { PlaceOfferDto } from './dto/place-offer.dto';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Post('shop/:shopItemId/buy')
  @UseGuards(JwtAuthGuard)
  async buyFromShop(
    @Param('shopItemId', ParseIntPipe) shopItemId: number,
    @CurrentUser() user: User,
    @Body('quantity', ParseIntPipe) quantity = 1,
  ) {
    return this.marketService.buyFromShop(user, shopItemId, quantity);
  }

  // Admin: list shop items
  @Get('shop')
  async listShopItems() {
    // Admin-facing: return all shop items (admin UI)
    return this.marketService.listShopItems();
  }

  // Public: list only active shop items for players
  @Get('shop/public')
  async listPublicShopItems() {
    return this.marketService.listPublicShopItems();
  }

  // Admin: add item to shop
  @Post('shop')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async addShopItem(
    @Body('itemId', ParseIntPipe) itemId: number,
    @Body('price', ParseIntPipe) price: number,
    @Body('quantity', ParseIntPipe) quantity = 1,
  ) {
    return this.marketService.addShopItem(itemId, price, quantity);
  }

  // Admin: deactivate/remove shop item
  @Delete('shop/:id')
  async removeShopItem(@Param('id', ParseIntPipe) id: number) {
    return this.marketService.removeShopItem(id);
  }

  // Admin: update shop item (price, quantity, active)
  @Patch('shop/:id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateShopItem(
    @Param('id', ParseIntPipe) id: number,
    @Body('price') price: number,
    @Body('quantity') quantity: number,
    @Body('active') active: boolean,
  ) {
    return this.marketService.updateShopItem(id, price, quantity, active);
  }

  // Admin: list market listings
  @Get('listings')
  async listListings() {
    return this.marketService.listListings();
  }

  // Admin: list offers (all)
  @Get('offers')
  async listOffers() {
    return this.marketService.listOffers();
  }

  // Admin: list offers for a specific listing
  @Get('listings/:id/offers')
  async listListingOffers(@Param('id', ParseIntPipe) id: number) {
    return this.marketService.listOffersForListing(id);
  }

  // Admin: purchase history
  @Get('history')
  async listPurchaseHistory() {
    return this.marketService.listPurchaseHistory();
  }

  @Post('listings')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseGuards(JwtAuthGuard)
  async createListing(
    @Body() body: CreateListingDto,
    @CurrentUser() user: User,
  ) {
    return this.marketService.createListing(
      user,
      body.userItemId,
      body.price,
      body.quantity,
    );
  }

  @Post('listings/:id/offer')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @UseGuards(JwtAuthGuard)
  async placeOffer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PlaceOfferDto,
    @CurrentUser() user: User,
  ) {
    return this.marketService.placeOffer(
      user,
      id,
      body.amount,
      body.quantity || 1,
    );
  }

  @Post('offers/:id/accept')
  @UseGuards(JwtAuthGuard)
  async acceptOffer(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.marketService.acceptOffer(user, id);
  }

  @Post('offers/:id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelOffer(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.marketService.cancelOffer(user, id);
  }
}
