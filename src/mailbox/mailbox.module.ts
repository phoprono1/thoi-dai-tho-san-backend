import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailboxController } from './mailbox.controller';
import { MailboxService } from './mailbox.service';
import { Mailbox } from './mailbox.entity';
import { MailboxGateway } from './mailbox.gateway';
import { UsersModule } from '../users/users.module';
import { UserItemsModule } from '../user-items/user-items.module';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Mailbox, User]),
    UsersModule,
    UserItemsModule,
  ],
  controllers: [MailboxController],
  providers: [MailboxService, MailboxGateway],
  exports: [MailboxService, MailboxGateway],
})
export class MailboxModule {}
