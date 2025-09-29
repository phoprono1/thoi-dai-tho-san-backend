/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage, ChatType } from './chat-message.entity';
import { User } from '../users/user.entity';
import { SendMessageDto, ChatMessageResponseDto } from './chat.dto';
import { GuildMember } from '../guild/guild.entity';
import { UserTitle } from '../titles/user-title.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(GuildMember)
    private guildMemberRepository?: Repository<any>,
    @InjectRepository(UserTitle)
    private userTitleRepository?: Repository<UserTitle>,
  ) {}

  private async getUserEquippedTitle(userId: number) {
    if (!this.userTitleRepository) return null;

    const equippedTitle = await this.userTitleRepository.findOne({
      where: { userId, isEquipped: true },
      relations: ['title'],
    });

    if (!equippedTitle?.title) return null;

    return {
      name: equippedTitle.title.name,
      prefix: equippedTitle.title.displayEffects?.prefix,
      displayEffects: equippedTitle.title.displayEffects,
    };
  }

  async sendMessage(
    userId: number,
    dto: SendMessageDto,
  ): Promise<ChatMessageResponseDto> {
    // Validate user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate guild chat permissions
    if (dto.type === ChatType.GUILD) {
      if (!dto.guildId) {
        throw new BadRequestException('Guild ID is required for guild chat');
      }

      // Verify membership
      if (this.guildMemberRepository) {
        const membership = await this.guildMemberRepository.findOne({
          where: { guildId: dto.guildId, userId },
        });
        if (!membership) {
          throw new ForbiddenException('User is not member of the guild');
        }
      }
    }

    // Create message
    const message = this.chatMessageRepository.create({
      userId,
      message: dto.message,
      type: dto.type,
      guildId: dto.guildId,
    });

    const savedMessage = await this.chatMessageRepository.save(message);
    const userTitle = await this.getUserEquippedTitle(userId);

    return {
      id: savedMessage.id,
      userId: savedMessage.userId,
      username: user.username,
      message: savedMessage.message,
      type: savedMessage.type,
      guildId: savedMessage.guildId,
      createdAt: savedMessage.createdAt,
      userTitle,
    };
  }

  async getWorldMessages(
    limit: number = 50,
  ): Promise<ChatMessageResponseDto[]> {
    const messages = await this.chatMessageRepository.find({
      where: { type: ChatType.WORLD, isDeleted: false },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const messagesWithTitles = await Promise.all(
      messages.reverse().map(async (msg) => {
        const userTitle = await this.getUserEquippedTitle(msg.userId);
        return {
          id: msg.id,
          userId: msg.userId,
          username: msg.user.username,
          message: msg.message,
          type: msg.type,
          createdAt: msg.createdAt,
          userTitle,
        };
      }),
    );

    return messagesWithTitles;
  }

  async getGuildMessages(
    guildId: number,
    limit: number = 50,
  ): Promise<ChatMessageResponseDto[]> {
    const messages = await this.chatMessageRepository.find({
      where: { type: ChatType.GUILD, guildId, isDeleted: false },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const messagesWithTitles = await Promise.all(
      messages.reverse().map(async (msg) => {
        const userTitle = await this.getUserEquippedTitle(msg.userId);
        return {
          id: msg.id,
          userId: msg.userId,
          username: msg.user.username,
          message: msg.message,
          type: msg.type,
          guildId: msg.guildId,
          createdAt: msg.createdAt,
          userTitle,
        };
      }),
    );

    return messagesWithTitles;
  }

  async deleteMessage(messageId: number, userId: number): Promise<void> {
    const message = await this.chatMessageRepository.findOne({
      where: { id: messageId, userId },
    });

    if (!message) {
      throw new NotFoundException('Message not found or not owned by user');
    }

    message.isDeleted = true;
    await this.chatMessageRepository.save(message);
  }
}
