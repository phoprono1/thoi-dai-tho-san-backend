import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ShopItem } from './shop-item.entity';
import { MarketListing } from './market-listing.entity';
import { MarketOffer } from './market-offer.entity';
import { PurchaseHistory } from './purchase-history.entity';
import { MailboxService } from '../mailbox/mailbox.service';
import { Mailbox, MailType } from '../mailbox/mailbox.entity';
import { User } from '../users/user.entity';
import { Escrow } from './escrow.entity';
import { MailboxGateway } from '../mailbox/mailbox.gateway';

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
  async addShopItem(itemId: number, price: number) {
    const it = this.shopItemRepo.create({ itemId, price, active: true });
    return this.shopItemRepo.save(it);
  }

  // List shop items (for admin UI)
  async listShopItems() {
    return this.shopItemRepo.find({ order: { createdAt: 'DESC' } });
  }

  // Remove (deactivate) shop item
  async removeShopItem(id: number) {
    const it = await this.shopItemRepo.findOne({ where: { id } });
    if (!it) throw new NotFoundException('Shop item not found');
    it.active = false;
    return this.shopItemRepo.save(it);
  }

  // Player buys from admin shop (buy now)
  async buyFromShop(buyer: User, shopItemId: number) {
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

    if ((buyer.gold || 0) < shopItem.price)
      throw new BadRequestException('Insufficient gold');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Deduct gold from buyer using transaction manager
      buyer.gold = (buyer.gold || 0) - shopItem.price;
      console.log('[MarketService.buyFromShop] deducting gold', {
        buyerId: buyer.id,
        newGold: buyer.gold,
      });
      await queryRunner.manager.save(User, buyer);

      // Create purchase history within transaction
      const ph = queryRunner.manager.create(PurchaseHistory, {
        buyerId: buyer.id,
        sellerId: 0, // system
        itemId: shopItem.itemId,
        price: shopItem.price,
      });
      await queryRunner.manager.save(PurchaseHistory, ph);

      // Send mail with rewards (item) inside the same transaction so mail is only created if transaction succeeds
      const mailEntity = queryRunner.manager.create(Mailbox, {
        userId: buyer.id,
        title: 'Shop purchase',
        content: `Purchased item ${shopItem.itemId}`,
        type: MailType.REWARD,
        rewards: { items: [{ itemId: shopItem.itemId, quantity: 1 }] },
      });
      // Save via transaction manager
      await queryRunner.manager.save(Mailbox, mailEntity);
      console.log('[MarketService.buyFromShop] mailbox entity created', {
        mailId: mailEntity.id,
        userId: mailEntity.userId,
      });

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
  async createListing(seller: User, itemId: number, price: number) {
    const listing = this.listingRepo.create({
      sellerId: seller.id,
      itemId,
      price,
      active: true,
    });
    return this.listingRepo.save(listing);
  }

  // Offer flow: buyer places an offer (we don't lock funds here for simplicity, but we'll create offer record)
  // Place an offer and hold funds (deduct buyer gold as an escrow)
  async placeOffer(buyer: User, listingId: number, amount: number) {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId, active: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    if ((buyer.gold || 0) < amount)
      throw new BadRequestException('Insufficient gold to place offer');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Deduct buyer gold as escrow
      buyer.gold = (buyer.gold || 0) - amount;
      await queryRunner.manager.save(User, buyer);

      // Create offer within transaction
      const offer = queryRunner.manager.create(MarketOffer, {
        listingId,
        buyerId: buyer.id,
        amount,
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
        this.mailboxGateway.emitMailReceived(refundMail.userId, refundMail.id);
        const unread = await this.mailboxService.getUnreadCount(
          refundMail.userId,
        );
        this.mailboxGateway.emitUnreadCount(refundMail.userId, unread);
      } catch (e) {
        console.error('Failed to emit mailbox notification', e);
      }
      return { message: 'Offer cancelled and refund queued' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Seller accepts an offer -> transfer item via mailbox and create history; refund other offers
  async acceptOffer(seller: User, offerId: number) {
    const offer = await this.offerRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Offer not found');

    const listing = await this.listingRepo.findOne({
      where: { id: offer.listingId },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== seller.id)
      throw new BadRequestException('Not the seller');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Mark offer accepted
      offer.accepted = true;
      await queryRunner.manager.save(MarketOffer, offer);

      // Mark listing inactive
      listing.active = false;
      await queryRunner.manager.save(MarketListing, listing);

      // Create purchase history
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

      // Send mail to buyer with item
      const buyerMail = queryRunner.manager.create(Mailbox, {
        userId: offer.buyerId,
        title: 'Black market purchase',
        content: `You won the offer for item ${listing.itemId}`,
        type: MailType.REWARD,
        rewards: { items: [{ itemId: listing.itemId, quantity: 1 }] },
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
      for (const o of otherOffers) {
        if (o.id === offer.id) continue;

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
        await queryRunner.manager.save(Mailbox, refundMail);
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
        for (const o of otherOffers) {
          if (o.id === offer.id) continue;
          // find the refund mail for this buyer (simple approach: fetch latest unread mail)
          const unread = await this.mailboxService.getUnreadCount(o.buyerId);
          this.mailboxGateway.emitUnreadCount(o.buyerId, unread);
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
    return this.listingRepo.find({ order: { createdAt: 'DESC' } });
  }

  // Admin: list offers
  async listOffers() {
    return this.offerRepo.find({ order: { createdAt: 'DESC' } });
  }

  async listOffersForListing(listingId: number) {
    return this.offerRepo.find({
      where: { listingId },
      order: { createdAt: 'DESC' },
    });
  }

  async listPurchaseHistory() {
    return this.historyRepo.find({ order: { createdAt: 'DESC' } });
  }
}
