import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyLoginService } from './daily-login.service';
import { DailyLoginController } from './daily-login.controller';
import { DailyLoginConfig } from './daily-login-config.entity';
import { DailyLoginRecord } from './daily-login-record.entity';
import { User } from '../users/user.entity';
import { MailboxModule } from '../mailbox/mailbox.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyLoginConfig, DailyLoginRecord, User]),
    MailboxModule,
  ],
  controllers: [DailyLoginController],
  providers: [DailyLoginService],
  exports: [DailyLoginService],
})
export class DailyLoginModule {}
