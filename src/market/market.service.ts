import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { ShopItem } from './shop-item.entity';
import { MarketListing } from './market-listing.entity';
import { MarketOffer } from './market-offer.entity';
import { PurchaseHistory } from './purchase-history.entity';
import { MailboxService } from '../mailbox/mailbox.service';
import { Mailbox, MailType } from '../mailbox/mailbox.entity';
import { User } from '../users/user.entity';
import { Escrow } from './escrow.entity';
import { MailboxGateway } from '../mailbox/mailbox.gateway';
import { UserItem } from '../user-items/user-item.entity';
import { Item } from '../items/item.entity';

@Injectable()
export class MarketService {
  constructor(
    @InjectRepository(ShopItem)
    private shopItemRepo: Repository<ShopItem>,
    @InjectRepository(MarketListing)
    private listingRepo: Repository<MarketListing>,
    @InjectRepository(MarketOffer)
    private offerRepo: Repository<MarketOffer>,
    @InjectRepository(PurchaseHistory)
    private historyRepo: Repository<PurchaseHistory>,
    private readonly mailboxService: MailboxService,
    private readonly mailboxGateway: MailboxGateway,
    private readonly dataSource: DataSource,
  ) {}

  // Admin-facing: add item to shop
  async addShopItem(itemId: number, price: number, quantity = 1) {
    const it = this.shopItemRepo.create({
      itemId,
      price,
      active: true,
      quantity,
    });
    return this.shopItemRepo.save(it);
  }

  // Player-facing: list only active shop items
  async listPublicShopItems() {
    const shopItems = await this.shopItemRepo.find({
      where: { active: true },
      order: { createdAt: 'DESC' },
    });

    // Fetch item details for each shop item
    const itemIds = shopItems.map((item) => item.itemId);
    const items = await this.dataSource
      .getRepository(Item)
      .find({ where: { id: In(itemIds) } });

    const itemMap = new Map(items.map((item) => [item.id, item]));

    return shopItems.map((shopItem) => ({
      id: shopItem.id,
      itemId: shopItem.itemId,
      price: shopItem.price,
      quantity: shopItem.quantity,
      active: shopItem.active,
      createdAt: shopItem.createdAt,
      item: itemMap.get(shopItem.itemId)
        ? {
            name: itemMap.get(shopItem.itemId).name,
            imageUrl: itemMap.get(shopItem.itemId).image,
            rarity: itemMap.get(shopItem.itemId).rarity,
            type: itemMap.get(shopItem.itemId).type,
          }
        : null,
    }));
  }

  // List shop items (for admin UI)
  async listShopItems() {
    return this.shopItemRepo.find({ order: { createdAt: 'DESC' } });
  }

  // Remove (deactivate) shop item
  async removeShopItem(id: number) {
    const it = await this.shopItemRepo.findOne({ where: { id } });
    if (!it) throw new NotFoundException('Shop item not found');
    // Hard delete for admin remove
    await this.shopItemRepo.delete({ id });
    return { message: 'Shop item removed' };
  }

  async updateShopItem(
    id: number,
    price?: number,
    quantity?: number,
    active?: boolean,
  ) {
    const it = await this.shopItemRepo.findOne({ where: { id } });
    if (!it) throw new NotFoundException('Shop item not found');
    if (typeof price === 'number') it.price = price;
    if (typeof quantity === 'number') it.quantity = quantity;
    if (typeof active === 'boolean') it.active = active;

    // If quantity set to >0, ensure active true
    if (typeof quantity === 'number' && quantity > 0) it.active = true;

    return this.shopItemRepo.save(it);
  }

  // Player buys from admin shop (buy now)
  async buyFromShop(buyer: User, shopItemId: number, quantity = 1) {
    console.log('[MarketService.buyFromShop] start', {
      buyerId: buyer?.id,
      shopItemId,
    });

    if (!buyer || !buyer.id) {
      console.warn('[MarketService.buyFromShop] missing authenticated user');
      throw new UnauthorizedException('Authentication required');
    }
    const shopItem = await this.shopItemRepo.findOne({
      where: { id: shopItemId },
    });
    console.log('[MarketService.buyFromShop] shopItem fetched', {
      shopItem: shopItem
        ? {
            id: shopItem.id,
            itemId: shopItem.itemId,
            price: shopItem.price,
            active: shopItem.active,
          }
        : null,
    });
    if (!shopItem || !shopItem.active)
      throw new NotFoundException('Shop item not found');

    if (quantity <= 0) throw new BadRequestException('Invalid quantity');
    if ((shopItem.quantity || 0) < quantity)
      throw new BadRequestException('Not enough stock');

    const totalPrice = shopItem.price * quantity;
    if ((buyer.gold || 0) < totalPrice)
      throw new BadRequestException('Insufficient gold');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Deduct gold from buyer using transaction manager
      buyer.gold = (buyer.gold || 0) - totalPrice;
      console.log('[MarketService.buyFromShop] deducting gold', {
        buyerId: buyer.id,
        newGold: buyer.gold,
      });
      await queryRunner.manager.save(User, buyer);

      // Create purchase history within transaction (record total price)
      const ph = queryRunner.manager.create(PurchaseHistory, {
        buyerId: buyer.id,
        sellerId: 0, // system
        itemId: shopItem.itemId,
        price: totalPrice,
      });
      await queryRunner.manager.save(PurchaseHistory, ph);

      // Send mail with rewards (item) inside the same transaction so mail is only created if transaction succeeds
      const mailEntity = queryRunner.manager.create(Mailbox, {
        userId: buyer.id,
        title: 'Shop purchase',
        content: `Purchased item ${shopItem.itemId}`,
        type: MailType.REWARD,
        rewards: { items: [{ itemId: shopItem.itemId, quantity }] },
      });
      // Save via transaction manager
      await queryRunner.manager.save(Mailbox, mailEntity);
      console.log('[MarketService.buyFromShop] mailbox entity created', {
        mailId: mailEntity.id,
        userId: mailEntity.userId,
      });

      // decrement shop stock
      shopItem.quantity = (shopItem.quantity || 0) - quantity;
      if (shopItem.quantity <= 0) {
        shopItem.active = false;
        shopItem.quantity = 0;
      }
      await queryRunner.manager.save(ShopItem, shopItem);

      await queryRunner.commitTransaction();
      console.log('[MarketService.buyFromShop] transaction committed');

      // Emit mailbox notification outside the DB transaction (safe now)
      try {
        this.mailboxGateway.emitMailReceived(mailEntity.userId, mailEntity.id);
        const unread = await this.mailboxService.getUnreadCount(
          mailEntity.userId,
        );
        this.mailboxGateway.emitUnreadCount(mailEntity.userId, unread);
      } catch (e) {
        console.error('Failed to emit mailbox notification', e);
      }

      return { message: 'Purchase queued via mailbox' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error(
        '[MarketService.buyFromShop] error, rolled back transaction',
        err,
      );
      // rethrow so Nest returns 500 and we have logs
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Player lists an item on the black market
  async createListing(
    seller: User,
    userItemId: number,
    price: number,
    quantity = 1,
  ) {
    // Reserve items from the specific UserItem row atomically using a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Load the specific UserItem by id and ensure ownership. Use a pessimistic write lock
      // to prevent concurrent listings from oversubscribing the same UserItem.
      const userItem = await queryRunner.manager
        .createQueryBuilder(UserItem, 'ui')
        .setLock('pessimistic_write')
        .where('ui.id = :id', { id: userItemId })
        .getOne();
      if (!userItem) throw new NotFoundException('UserItem not found');
      if (userItem.userId !== seller.id)
        throw new BadRequestException('Not the owner of the item');

      // Check underlying Item.tradable flag to prevent player-to-player trade if item is locked
      const item = await queryRunner.manager.findOne(Item, {
        where: { id: userItem.itemId },
      });
      const isTradable = item ? Boolean(item.tradable) : true;
      if (!isTradable) {
        throw new BadRequestException(
          'This item is not tradable between players',
        );
      }

      const available = userItem.quantity || 0;
      if (available < quantity) {
        throw new BadRequestException('Not enough items to list');
      }

      // Decrement the UserItem (reserve units for listing)
      if (userItem.quantity <= quantity) {
        // remove the row entirely
        await queryRunner.manager.delete(UserItem, { id: userItem.id });
      } else {
        userItem.quantity = userItem.quantity - quantity;
        await queryRunner.manager.save(UserItem, userItem);
      }

      // Create listing pointing to the underlying itemId
      const listing = queryRunner.manager.create(MarketListing, {
        sellerId: seller.id,
        itemId: userItem.itemId,
        price,
        quantity,
        active: true,
      });
      const saved = await queryRunner.manager.save(MarketListing, listing);

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Offer flow: buyer places an offer (we don't lock funds here for simplicity, but we'll create offer record)
  // Place an offer and hold funds (deduct buyer gold as an escrow)
  async placeOffer(
    buyer: User,
    listingId: number,
    amount: number,
    quantity = 1,
  ) {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId, active: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    if (quantity <= 0) throw new BadRequestException('Invalid quantity');

    if ((buyer.gold || 0) < amount)
      throw new BadRequestException('Insufficient gold to place offer');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Ensure underlying item is tradable (guard in case admin created a listing via DB)
      const item = await queryRunner.manager.findOne(Item, {
        where: { id: listing.itemId },
      });
      const isTradable = item ? Boolean(item.tradable) : true;
      if (!isTradable) {
        throw new BadRequestException(
          'Cannot place offer: item is not tradable between players',
        );
      }
      // Optionally lock buyer row if multiple concurrent placeOffer calls may race on buyer.gold.
      // We'll lock the buyer row to ensure gold deduction is safe.
      await queryRunner.manager
        .createQueryBuilder(User, 'u')
        .setLock('pessimistic_write')
        .where('u.id = :id', { id: buyer.id })
        .getOne();
      // Deduct buyer gold as escrow
      buyer.gold = (buyer.gold || 0) - amount;
      await queryRunner.manager.save(User, buyer);

      // Create offer within transaction
      const offer = queryRunner.manager.create(MarketOffer, {
        listingId,
        buyerId: buyer.id,
        amount,
        quantity,
        accepted: false,
      });
      const saved = await queryRunner.manager.save(MarketOffer, offer);

      // Create escrow record to track held funds
      const esc = queryRunner.manager.create(Escrow, {
        offerId: saved.id,
        buyerId: buyer.id,
        amount,
        released: false,
        refunded: false,
      });
      await queryRunner.manager.save(Escrow, esc);

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Allow buyer to cancel their own offer and receive refund via mailbox
  async cancelOffer(buyer: User, offerId: number) {
    const offer = await this.offerRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.buyerId !== buyer.id)
      throw new BadRequestException('Not the offer owner');
    if (offer.accepted) throw new BadRequestException('Offer already accepted');
    if (offer.cancelled)
      throw new BadRequestException('Offer already cancelled');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // mark cancelled
      offer.cancelled = true;
      await queryRunner.manager.save(MarketOffer, offer);

      // mark escrow refunded if present
      const escrow = await queryRunner.manager.findOne(Escrow, {
        where: { offerId: offer.id, refunded: false },
      });
      if (escrow) {
        escrow.refunded = true;
        await queryRunner.manager.save(Escrow, escrow);
      }

      // refund via mailbox
      const refundMail = queryRunner.manager.create(Mailbox, {
        userId: offer.buyerId,
        title: 'Offer cancelled',
        content: `Your offer on item ${offer.listingId} was cancelled and refunded`,
        type: MailType.REWARD,
        rewards: { gold: offer.amount },
      });
      await queryRunner.manager.save(Mailbox, refundMail);

      // emit websocket notification after commit (we'll emit after commit below)

      await queryRunner.commitTransaction();

      // Emit notifications outside the DB transaction (safe now)
      try {
        // mailboxGateway will send socket events to the user's room
        this.mailboxGateway.emitMailReceived(refundMail.userId, refundMail.id);
        const unread = await this.mailboxService.getUnreadCount(
          refundMail.userId,
        );
        this.mailboxGateway.emitUnreadCount(refundMail.userId, unread);
      } catch (e) {
        console.error('Failed to emit mailbox notification', e);
      }

      // return the listing id so frontend can refresh offers for that listing
      return {
        message: 'Offer cancelled and refund queued',
        listingId: offer.listingId,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Seller accepts an offer -> transfer item via mailbox and create history; refund other offers
  async acceptOffer(seller: User, offerId: number) {
    // We'll perform the accept flow inside a transaction and lock the listing row
    // with a pessimistic write lock to prevent concurrent accepts that could oversell.
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Reload and lock the offer row
      const offer = await queryRunner.manager
        .createQueryBuilder(MarketOffer, 'o')
        .setLock('pessimistic_write')
        .where('o.id = :id', { id: offerId })
        .getOne();
      if (!offer) throw new NotFoundException('Offer not found');

      // Reload and lock the listing row
      const listing = await queryRunner.manager
        .createQueryBuilder(MarketListing, 'l')
        .setLock('pessimistic_write')
        .where('l.id = :id', { id: offer.listingId })
        .getOne();
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.sellerId !== seller.id)
        throw new BadRequestException('Not the seller');

      // Ensure underlying item is tradable before accepting the offer
      const item = await queryRunner.manager.findOne(Item, {
        where: { id: listing.itemId },
      });
      const isTradable = item ? Boolean(item.tradable) : true;
      if (!isTradable) {
        throw new BadRequestException(
          'Cannot accept offer: item is not tradable between players',
        );
      }

      // Mark offer accepted
      offer.accepted = true;
      await queryRunner.manager.save(MarketOffer, offer);

      // Determine how many units this offer buys
      const units = offer.quantity || 1;

      // If offer requests more than available, reject
      if (units > (listing.quantity || 0)) {
        throw new BadRequestException(
          'Offer quantity exceeds available listing quantity',
        );
      }

      // Decrement listing quantity by offered units
      listing.quantity = (listing.quantity || 0) - units;

      // If zero, remove the listing to keep the marketplace clean, otherwise persist the updated quantity
      if (listing.quantity <= 0) {
        await queryRunner.manager.delete(MarketListing, { id: listing.id });
      } else {
        await queryRunner.manager.save(MarketListing, listing);
      }

      // Create purchase history (record total amount)
      const ph = queryRunner.manager.create(PurchaseHistory, {
        buyerId: offer.buyerId,
        sellerId: seller.id,
        itemId: listing.itemId,
        price: offer.amount,
      });
      await queryRunner.manager.save(PurchaseHistory, ph);

      // Capture escrow for this offer (mark released)
      const escrow = await queryRunner.manager.findOne(Escrow, {
        where: { offerId: offer.id, released: false, refunded: false },
      });
      if (!escrow) {
        throw new BadRequestException('Escrow not found for offer');
      }
      escrow.released = true;
      await queryRunner.manager.save(Escrow, escrow);

      // NOTE: We deliver gold and items via mailbox mails to avoid race conditions
      // and to let users claim rewards through mailbox. Do NOT directly modify
      // seller.gold or buyer inventory here (that was causing duplicate transfers).

      // Send mail to buyer with item(s)
      const buyerMail = queryRunner.manager.create(Mailbox, {
        userId: offer.buyerId,
        title: 'Black market purchase',
        content: `You won the offer for item ${listing.itemId}`,
        type: MailType.REWARD,
        rewards: { items: [{ itemId: listing.itemId, quantity: units }] },
      });
      await queryRunner.manager.save(Mailbox, buyerMail);

      // Send mail to seller with gold (payout)
      const sellerMail = queryRunner.manager.create(Mailbox, {
        userId: seller.id,
        title: 'Item sold',
        content: `Your item ${listing.itemId} sold for ${offer.amount} gold`,
        type: MailType.REWARD,
        rewards: { gold: offer.amount },
      });
      await queryRunner.manager.save(Mailbox, sellerMail);

      // Refund other offers (return escrow to buyers) and mark them cancelled
      const otherOffers = await queryRunner.manager.find(MarketOffer, {
        where: { listingId: listing.id, accepted: false, cancelled: false },
      });

      // we'll collect refund mails to emit notifications after commit
      const refundMailsToEmit: Array<{ userId: number; mailId: number }> = [];

      for (const o of otherOffers) {
        if (o.id === offer.id) continue;

        // Only refund offers that now request more units than remain (cannot be satisfied)
        if ((o.quantity || 1) > (listing.quantity || 0)) {
          // Mark offer cancelled
          o.cancelled = true;
          await queryRunner.manager.save(MarketOffer, o);

          // Mark escrow refunded if present and create mailbox refund
          const oe = await queryRunner.manager.findOne(Escrow, {
            where: { offerId: o.id, refunded: false, released: false },
          });
          if (oe) {
            oe.refunded = true;
            await queryRunner.manager.save(Escrow, oe);
          }

          const refundMail = queryRunner.manager.create(Mailbox, {
            userId: o.buyerId,
            title: 'Offer refunded',
            content: `Your offer on item ${listing.itemId} was not accepted and your funds are refunded`,
            type: MailType.REWARD,
            rewards: { gold: o.amount },
          });
          const savedRefund = await queryRunner.manager.save(
            Mailbox,
            refundMail,
          );
          refundMailsToEmit.push({
            userId: savedRefund.userId,
            mailId: savedRefund.id,
          });
        }
      }

      await queryRunner.commitTransaction();

      // emit notifications for mails
      try {
        // emit buyer mail
        this.mailboxGateway.emitMailReceived(buyerMail.userId, buyerMail.id);
        const buyerUnread = await this.mailboxService.getUnreadCount(
          buyerMail.userId,
        );
        this.mailboxGateway.emitUnreadCount(buyerMail.userId, buyerUnread);

        // emit seller mail
        this.mailboxGateway.emitMailReceived(sellerMail.userId, sellerMail.id);
        const sellerUnread = await this.mailboxService.getUnreadCount(
          sellerMail.userId,
        );
        this.mailboxGateway.emitUnreadCount(sellerMail.userId, sellerUnread);

        // emit refunds for other buyers
        for (const r of refundMailsToEmit) {
          try {
            this.mailboxGateway.emitMailReceived(r.userId, r.mailId);
            const unread = await this.mailboxService.getUnreadCount(r.userId);
            this.mailboxGateway.emitUnreadCount(r.userId, unread);
          } catch (e) {
            console.error(
              'Failed to emit refund mailbox notification for user',
              r.userId,
              e,
            );
          }
        }
      } catch (e) {
        console.error('Failed to emit mailbox notifications', e);
      }
      return { message: 'Offer accepted and mails queued' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Expire offers older than `olderThanMs` (used by scheduler). Default: 48 hours
  async expireOldOffers(olderThanMs = 1000 * 60 * 60 * 24 * 2) {
    const cutoff = new Date(Date.now() - olderThanMs);
    const staleOffers = await this.offerRepo.find({
      where: { accepted: false, cancelled: false },
    });

    // Filter by createdAt older than cutoff
    const toExpire = staleOffers.filter(
      (o) => o.createdAt && o.createdAt < cutoff,
    );

    for (const o of toExpire) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        o.cancelled = true;
        await queryRunner.manager.save(MarketOffer, o);

        const refundMail = queryRunner.manager.create(Mailbox, {
          userId: o.buyerId,
          title: 'Offer expired',
          content: `Your offer on item ${o.listingId} expired and was refunded`,
          type: MailType.REWARD,
          rewards: { gold: o.amount },
        });
        await queryRunner.manager.save(Mailbox, refundMail);

        await queryRunner.commitTransaction();

        // emit mailbox notification for expired offer refund
        try {
          this.mailboxGateway.emitMailReceived(
            refundMail.userId,
            refundMail.id,
          );
          const unread = await this.mailboxService.getUnreadCount(
            refundMail.userId,
          );
          this.mailboxGateway.emitUnreadCount(refundMail.userId, unread);
        } catch (e) {
          console.error(
            'Failed to emit mailbox notification for expired offer',
            e,
          );
        }
      } catch (err) {
        await queryRunner.rollbackTransaction();
        // swallow individual errors and continue expiring others
        console.error('Failed to expire offer', err);
      } finally {
        await queryRunner.release();
      }
    }

    return { expired: toExpire.length };
  }

  // Admin helpers: list listings
  async listListings() {
    const listings = await this.listingRepo.find({
      order: { createdAt: 'DESC' },
    });

    // Fetch item details for each listing
    const itemIds = listings.map((listing) => listing.itemId);
    const items = await this.dataSource
      .getRepository(Item)
      .find({ where: { id: In(itemIds) } });

    const itemMap = new Map(items.map((item) => [item.id, item]));

    return listings.map((listing) => ({
      id: listing.id,
      sellerId: listing.sellerId,
      itemId: listing.itemId,
      price: listing.price,
      quantity: listing.quantity,
      active: listing.active,
      createdAt: listing.createdAt,
      item: itemMap.get(listing.itemId)
        ? {
            name: itemMap.get(listing.itemId).name,
            imageUrl: itemMap.get(listing.itemId).image,
            rarity: itemMap.get(listing.itemId).rarity,
            type: itemMap.get(listing.itemId).type,
          }
        : null,
    }));
  }

  // Admin: list offers
  async listOffers() {
    return this.offerRepo.find({ order: { createdAt: 'DESC' } });
  }

  async listOffersForListing(listingId: number) {
    // Exclude cancelled offers so users can re-offer and UI stays clean
    return this.offerRepo.find({
      where: { listingId, cancelled: false },
      order: { createdAt: 'DESC' },
    });
  }

  async listPurchaseHistory() {
    return this.historyRepo.find({ order: { createdAt: 'DESC' } });
  }
}
