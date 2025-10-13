import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GiftCode } from './giftcode.entity';
import { GiftCodeUsage } from './giftcode-usage.entity';
import { MailboxService } from '../mailbox/mailbox.service';

@Injectable()
export class GiftCodeService {
  constructor(
    @InjectRepository(GiftCode)
    private giftRepo: Repository<GiftCode>,
    @InjectRepository(GiftCodeUsage)
    private usageRepo: Repository<GiftCodeUsage>,
    private readonly dataSource: DataSource,
    private readonly mailboxService: MailboxService,
  ) {}

  async create(dto: any) {
    const g = this.giftRepo.create({
      code: dto.code,
      rewards: dto.rewards || null,
      usesAllowed: typeof dto.usesAllowed === 'number' ? dto.usesAllowed : null,
      usesRemaining:
        typeof dto.usesAllowed === 'number' ? dto.usesAllowed : null,
      expiresAt: dto.expiresAt || null,
      isActive: true,
    });

    return this.giftRepo.save(g);
  }

  async redeem(userId: number, code: string) {
    // Use transaction to avoid races
    return this.dataSource.transaction(async (manager) => {
      const gift = await manager.findOne(GiftCode, { where: { code } });
      if (!gift) throw new NotFoundException('Gift code not found');
      if (!gift.isActive) throw new BadRequestException('Gift code inactive');
      if (gift.expiresAt && gift.expiresAt < new Date())
        throw new BadRequestException('Gift code expired');

      // check if user already used
      const used = await manager.findOne(GiftCodeUsage, {
        where: { giftcodeId: gift.id, userId },
      });
      if (used) throw new BadRequestException('Already redeemed');

      if (typeof gift.usesRemaining === 'number') {
        if (gift.usesRemaining <= 0) {
          throw new BadRequestException('No uses remaining');
        }
        gift.usesRemaining = gift.usesRemaining - 1;
        await manager.save(gift);
      }

      // record usage
      const usage = manager.create(GiftCodeUsage, {
        giftcodeId: gift.id,
        userId,
      });
      await manager.save(usage);

      // Deliver via mailbox
      if (gift.rewards) {
        await this.mailboxService.sendMail({
          userId,
          title: `Giftcode ${gift.code}`,
          content: `You redeemed code ${gift.code}`,
          type: 'giftcode' as any,
          rewards: gift.rewards,
        });
      }

      return { success: true };
    });
  }

  async findAll() {
    return this.giftRepo.find({ order: { createdAt: 'DESC' } });
  }

  async deactivate(id: number) {
    const g = await this.giftRepo.findOne({ where: { id } });
    if (!g) throw new NotFoundException('Gift code not found');
    g.isActive = false;
    return this.giftRepo.save(g);
  }

  /**
   * Permanently remove a giftcode. This does not remove historical usages but
   * will prevent future redeems. Run inside transaction to be safe.
   */
  async remove(id: number) {
    return this.dataSource.transaction(async (manager) => {
      const g = await manager.findOne(GiftCode, { where: { id } });
      if (!g) throw new NotFoundException('Gift code not found');
      // Optionally, you could also archive or mark usages. For now delete the giftcode row.
      await manager.delete(GiftCode, { id });
      return { success: true };
    });
  }
}
