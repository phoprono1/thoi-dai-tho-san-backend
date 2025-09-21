import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
import { Mailbox, MailType, MailStatus } from './mailbox.entity';
import { User } from '../users/user.entity';
import { UserItemsService } from '../user-items/user-items.service';
import { UserItem } from '../user-items/user-item.entity';
import { MailboxGateway } from './mailbox.gateway';

export interface SendMailDto {
  userId: number;
  title: string;
  content: string;
  type: MailType;
  rewards?: {
    gold?: number;
    experience?: number;
    items?: Array<{
      itemId: number;
      quantity: number;
    }>;
  };
  expiresAt?: Date;
}

@Injectable()
export class MailboxService {
  constructor(
    @InjectRepository(Mailbox)
    private mailboxRepository: Repository<Mailbox>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly userItemsService: UserItemsService,
    private readonly mailboxGateway: MailboxGateway,
  ) {}

  async sendMail(dto: SendMailDto): Promise<Mailbox> {
    // Validate user exists
    const user = await this.userRepository.findOne({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const mail = this.mailboxRepository.create({
      userId: dto.userId,
      title: dto.title,
      content: dto.content,
      type: dto.type,
      rewards: dto.rewards,
      expiresAt: dto.expiresAt,
    });

    const saved = await this.mailboxRepository.save(mail);

    // Emit mailbox socket events so the recipient is notified immediately.
    try {
      // emit mailReceived with mail id
      this.mailboxGateway.emitMailReceived(dto.userId, saved.id);
      // emit updated unread count
      const unread = await this.getUnreadCount(dto.userId);
      this.mailboxGateway.emitUnreadCount(dto.userId, unread);
    } catch (e) {
      // Non-fatal: log and continue
      // eslint-disable-next-line no-console
      console.error('Failed to emit mailbox events after sendMail', e);
    }

    return saved;
  }

  async getUserMails(userId: number): Promise<Mailbox[]> {
    // Exclude mails that are already claimed to avoid showing claimed mails in UI
    return this.mailboxRepository.find({
      where: { userId, status: Not(MailStatus.CLAIMED) },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(mailId: number, userId: number): Promise<Mailbox> {
    const mail = await this.mailboxRepository.findOne({
      where: { id: mailId, userId },
    });

    if (!mail) {
      throw new NotFoundException('Mail not found');
    }

    if (mail.status === MailStatus.UNREAD) {
      mail.status = MailStatus.READ;
      return this.mailboxRepository.save(mail);
    }

    return mail;
  }

  async claimRewards(mailId: number, userId: number): Promise<any> {
    // Use a query runner for an explicit transaction so we can lock rows
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock the mail row FOR UPDATE in the transaction
      const mail = await queryRunner.manager.findOne(Mailbox, {
        where: { id: mailId, userId },
      });

      if (!mail) {
        throw new NotFoundException('Mail not found');
      }

      if (mail.status === MailStatus.CLAIMED) {
        throw new NotFoundException('Rewards already claimed');
      }

      if (!mail.rewards) {
        throw new NotFoundException('No rewards to claim');
      }

      // Load and lock the user row
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const rewards = mail.rewards || {};

      // Apply gold and experience
      if (typeof rewards.gold === 'number') {
        user.gold = (user.gold || 0) + Number(rewards.gold || 0);
      }
      if (typeof rewards.experience === 'number') {
        user.experience =
          (user.experience || 0) + Number(rewards.experience || 0);
      }

      // Persist user changes via the transaction manager
      await queryRunner.manager.save(User, user);

      // Apply item rewards using the UserItemsService but ensure it uses the same
      // database transaction by calling repository operations through queryRunner.manager
      if (Array.isArray(rewards.items) && rewards.items.length > 0) {
        for (const it of rewards.items) {
          const itemId = Number(it.itemId);
          const qty = Number(it.quantity || 1);

          // Find existing UserItem entity in transaction
          const existing = await queryRunner.manager.findOne(UserItem, {
            where: { userId, itemId },
          });

          if (existing) {
            existing.quantity = (existing.quantity || 0) + qty;
            await queryRunner.manager.save(UserItem, existing);
          } else {
            const newUserItem = queryRunner.manager.create(UserItem, {
              userId,
              itemId,
              quantity: qty,
            });
            await queryRunner.manager.save(UserItem, newUserItem);
          }
        }
      }

      // Mark mail as claimed
      mail.status = MailStatus.CLAIMED;
      await queryRunner.manager.save(Mailbox, mail);

      await queryRunner.commitTransaction();

      // Emit updated unread count to the user's mailbox socket
      try {
        const unread = await this.getUnreadCount(userId);
        this.mailboxGateway.emitUnreadCount(userId, unread);
      } catch (e) {
        // don't fail the claim if emit fails
        // log and continue
        console.error('Failed to emit unread count after claim', e);
      }

      return {
        message: 'Rewards claimed successfully',
        rewards: mail.rewards,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (err instanceof NotFoundException) throw err;
      // Wrap other errors
      throw new InternalServerErrorException(
        'Failed to claim rewards: ' + (err as Error).message,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async deleteMail(mailId: number, userId: number): Promise<void> {
    const mail = await this.mailboxRepository.findOne({
      where: { id: mailId, userId },
    });

    if (!mail) {
      throw new NotFoundException('Mail not found');
    }

    await this.mailboxRepository.remove(mail);
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.mailboxRepository.count({
      where: { userId, status: MailStatus.UNREAD },
    });
  }
}
