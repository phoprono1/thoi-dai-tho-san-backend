import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MarketService } from './market.service';

@Injectable()
export class MarketScheduler {
  private readonly logger = new Logger(MarketScheduler.name);

  constructor(private readonly marketService: MarketService) {}

  // Run once a day and expire offers older than 48 hours
  @Cron('0 2 * * *') // At 02:00 every day
  async handleExpire() {
    this.logger.log('Running market offer expiry job (48h)');
    try {
      const res = await this.marketService.expireOldOffers(
        1000 * 60 * 60 * 24 * 2,
      );
      this.logger.log(`Expired ${res.expired} offers`);
    } catch (err) {
      this.logger.error('Market expiry job failed', err);
    }
  }
}
