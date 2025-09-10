/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
// Test script for Chat System
// Run with: npx ts-node test_chat.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatService } from './chat.service';
import { ChatMessage, ChatType } from './chat-message.entity';
import { User } from '../users/user.entity';

describe('ChatService', () => {
  let service: ChatService;
  let chatMessageRepository: Repository<ChatMessage>;
  let userRepository: Repository<User>;

  const mockUser = {
    id: 1,
    username: 'testuser',
  };

  const mockChatMessage = {
    id: 1,
    userId: 1,
    message: 'Test message',
    type: ChatType.WORLD,
    createdAt: new Date(),
    isDeleted: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(ChatMessage),
          useValue: {
            create: jest.fn().mockReturnValue(mockChatMessage),
            save: jest.fn().mockResolvedValue(mockChatMessage),
            find: jest.fn().mockResolvedValue([mockChatMessage]),
            findOne: jest.fn().mockResolvedValue(mockChatMessage),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockUser),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    chatMessageRepository = module.get<Repository<ChatMessage>>(
      getRepositoryToken(ChatMessage),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send world message', async () => {
    const dto = {
      message: 'Hello world!',
      type: ChatType.WORLD,
    };

    const result = await service.sendMessage(1, dto);

    expect(result).toEqual({
      id: 1,
      userId: 1,
      username: 'testuser',
      message: 'Hello world!',
      type: ChatType.WORLD,
      createdAt: expect.any(Date),
    });
  });

  it('should get world messages', async () => {
    const messages = await service.getWorldMessages();

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe(ChatType.WORLD);
  });

  it('should send guild message', async () => {
    const dto = {
      message: 'Hello guild!',
      type: ChatType.GUILD,
      guildId: 123,
    };

    const result = await service.sendMessage(1, dto);

    expect(result.type).toBe(ChatType.GUILD);
    expect(result.guildId).toBe(123);
  });
});
