import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GiftCode } from './giftcode.entity';
import { GiftCodeUsage } from './giftcode-usage.entity';
import { GiftCodeService } from './giftcode.service';
import { GiftCodeController } from './giftcode.controller';
import { MailboxModule } from '../mailbox/mailbox.module';

@Module({
  imports: [TypeOrmModule.forFeature([GiftCode, GiftCodeUsage]), MailboxModule],
  providers: [GiftCodeService],
  controllers: [GiftCodeController],
  exports: [GiftCodeService],
})
export class GiftCodeModule {}
