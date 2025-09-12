/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { SendMessageDto } from './chat.dto';
import { ChatType } from './chat-message.entity';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../common/redis.provider';
import Redis from 'ioredis';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<number, AuthenticatedSocket>();

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    @Inject(REDIS_CLIENT) private readonly redisClient?: Redis,
  ) {}

  handleConnection(client: AuthenticatedSocket) {
    console.log(`[Chat] Client connected: ${client.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.connectedUsers.delete(client.userId);
      console.log(
        `[Chat] Client disconnected: ${client.id}, user: ${client.userId}`,
      );
    } else {
      console.log(`[Chat] Client disconnected: ${client.id}`);
    }
  }

  @SubscribeMessage('joinWorld')
  async handleJoinWorld(
    @MessageBody() data: { userId: number; token?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      console.log('[Chat] joinWorld received data:', {
        userId: data.userId,
        hasToken: !!data.token,
      });

      // Verify token if provided
      if (data.token) {
        try {
          console.log('[Chat] Attempting to verify token...');
          const payload = this.jwtService.verify(data.token);
          console.log('[Chat] Token verified successfully:', payload);
          client.userId = payload.sub;
          client.username = payload.username;
        } catch (error) {
          console.error('[Chat] Token verification failed:', error.message);
          client.emit('error', { message: 'Invalid authentication token' });
          return;
        }
      } else {
        client.userId = data.userId;
      }

      if (!client.userId) {
        client.emit('error', { message: 'User ID is required' });
        return;
      }

      this.connectedUsers.set(client.userId, client);
      await client.join('world');
      console.log(`[Chat] User ${client.userId} joined world chat.`);

      // Send chat history to the user
      const history = await this.chatService.getWorldMessages();
      client.emit('chatHistory', history);
    } catch (error) {
      console.error(`[Chat] Error joining world:`, error);
      client.emit('error', { message: 'Could not join world chat.' });
    }
  }

  @SubscribeMessage('sendWorldMessage')
  async handleSendWorldMessage(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!client.userId) {
        client.emit('error', { message: 'Not authenticated or joined.' });
        return;
      }

      // Defensive check: ensure message field exists and is not empty
      if (!dto || typeof dto.message !== 'string' || !dto.message.trim()) {
        client.emit('error', { message: 'Message is required' });
        return;
      }

      // Rate limiter using Redis: max 5 messages per 10 seconds per user
      try {
        if (this.redisClient) {
          const key = `rl:chat:world:${client.userId}`;
          const ttlSeconds = 10;
          const maxCount = 5;
          const cnt = await this.redisClient.incr(key);
          if (cnt === 1) {
            await this.redisClient.expire(key, ttlSeconds);
          }
          if (cnt > maxCount) {
            client.emit('error', { message: 'Rate limit exceeded' });
            return;
          }
        }
      } catch (e) {
        // If Redis fails, allow through (fail-open) but log
        console.warn('[Chat] Redis rate limiter error:', e?.message || e);
      }

      // Ensure the DTO has the correct user ID from the authenticated socket
      const messageDto: SendMessageDto = {
        ...dto,
        type: ChatType.WORLD, // Ensure type is world
      };

      const message = await this.chatService.sendMessage(
        client.userId,
        messageDto,
      );

      // Broadcast to world room
      this.server.to('world').emit('worldMessage', message);
    } catch (error) {
      console.error(`[Chat] Error sending world message:`, error);
      client.emit('error', { message: error.message });
    }
  }

  // --- Guild Chat Methods (can be kept for future use) ---

  @SubscribeMessage('joinGuild')
  async handleJoinGuild(
    @MessageBody() data: { guildId: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (client.userId && data.guildId) {
      await client.join(`guild_${data.guildId}`);
      client.emit('joinedGuild', { guildId: data.guildId });

      // Optionally send guild chat history
      const history = await this.chatService.getGuildMessages(data.guildId);
      client.emit('chatHistory', { guildId: data.guildId, messages: history });
    }
  }

  @SubscribeMessage('leaveGuild')
  async handleLeaveGuild(
    @MessageBody() data: { guildId: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (client.userId && data.guildId) {
      await client.leave(`guild_${data.guildId}`);
      client.emit('leftGuild', { guildId: data.guildId });
    }
  }
}
