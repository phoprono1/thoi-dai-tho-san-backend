import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mailbox, MailType, MailStatus } from './mailbox.entity';
import { User } from '../users/user.entity';

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

    return this.mailboxRepository.save(mail);
  }

  async getUserMails(userId: number): Promise<Mailbox[]> {
    return this.mailboxRepository.find({
      where: { userId },
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
    const mail = await this.mailboxRepository.findOne({
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

    // Here you would implement the logic to give rewards to user
    // For now, we'll just mark as claimed
    mail.status = MailStatus.CLAIMED;
    await this.mailboxRepository.save(mail);

    return {
      message: 'Rewards claimed successfully',
      rewards: mail.rewards,
    };
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
