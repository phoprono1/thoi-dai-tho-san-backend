/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { Injectable, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoomLobbyService } from './room-lobby.service';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/rooms',
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
@Injectable()
export class RoomLobbyGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger = new Logger(RoomLobbyGateway.name);

  constructor(private roomLobbyService: RoomLobbyService) {}

  // Fallback in-process combat handling when Redis/Bull is not used.
  // This keeps API compatibility for tests: enqueuing will simply schedule a quick simulated result.
  private simulateCombatResult(roomId: number, userIds: number[]) {
    // quick simulated payload
    const payload = {
      success: true,
      combat: {
        result: Math.random() > 0.3 ? 'victory' : 'defeat',
        duration: 100,
        logs: [{ turn: 1, action: 'simulated', details: {} }],
      },
    };
    // emit after small timeout to mimic async worker
    setTimeout(() => {
      try {
        this.server.to(`room_${roomId}`).emit('combatResult', payload);
      } catch (err) {
        console.error('Failed to emit simulated combat result', err);
      }
    }, 200);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Room client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Room client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: number; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      console.log(
        `[Socket] Client ${client.id} attempting to join room_${data.roomId} for user ${data.userId}`,
      );

      const roomInfo = await this.roomLobbyService.joinRoom(
        data.roomId,
        data.userId,
      );

      // Join the socket room
      await client.join(`room_${data.roomId}`);
      console.log(
        `[Socket] Client ${client.id} successfully joined room_${data.roomId}`,
      );

      // Store user data in socket for tracking
      client.data = {
        ...client.data,
        userId: data.userId,
        roomId: data.roomId,
      };

      // Verify client is in room
      const roomClients = this.server?.sockets?.adapter?.rooms?.get(
        `room_${data.roomId}`,
      );
      console.log(
        `[Socket] Room ${data.roomId} now has ${roomClients?.size || 0} clients:`,
        Array.from(roomClients || []).map((id) => {
          const socket = this.server?.sockets?.sockets?.get(id);
          return {
            socketId: id,
            userId: (socket?.data as any)?.userId || 'unknown',
          };
        }),
      );

      // Notify all players in room about the new player
      this.server.to(`room_${data.roomId}`).emit('roomUpdated', roomInfo);

      return { success: true, roomInfo };
    } catch (error) {
      console.error(
        `[Socket] Failed to join room ${data.roomId}:`,
        error instanceof Error ? error.message : error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @SubscribeMessage('toggleReady')
  async handleToggleReady(
    @MessageBody() data: { roomId: number; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(
      '[TOGGLE READY] Request:',
      `roomId=${data.roomId}, userId=${data.userId}`,
    );
    try {
      const room = await this.roomLobbyService.togglePlayerReady(
        data.roomId,
        data.userId,
      );
      console.log('[TOGGLE READY] Success for room:', room.id);

      // Notify all players in room about the ready state change
      this.server.to(`room_${data.roomId}`).emit('roomUpdated', room);

      return { success: true, roomInfo: room };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('[TOGGLE READY] Error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  @SubscribeMessage('startCombat')
  async handleStartCombat(
    @MessageBody() data: { roomId: number; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Call the actual combat start logic from the service
      const result = await this.roomLobbyService.startCombat(
        data.roomId,
        data.userId,
      );

      // Inform clients that combat has started and provide initial data
      this.server
        .to(`room_${data.roomId}`)
        .emit('combatStarted', result.combatResult);

      return { success: true, ...result };
    } catch (error) {
      console.error(
        `[Socket] Failed to start combat for room ${data.roomId}:`,
        error instanceof Error ? error.message : error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: number; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Leave the socket room
      await client.leave(`room_${data.roomId}`);

      // Remove player from room
      await this.roomLobbyService.removePlayerFromRoom(
        data.roomId,
        data.userId,
      );

      // Get updated room info and notify remaining players
      try {
        const roomInfo = await this.roomLobbyService.getRoomInfo(data.roomId);
        this.server.to(`room_${data.roomId}`).emit('roomUpdated', roomInfo);
      } catch {
        // Room might be deleted if no players left
        this.server.to(`room_${data.roomId}`).emit('roomClosed');
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @SubscribeMessage('updateDungeon')
  async handleUpdateDungeon(
    @MessageBody() data: { roomId: number; hostId: number; dungeonId: number },
  ) {
    try {
      console.log('[GATEWAY UPDATE DUNGEON DEBUG]', {
        receivedData: data,
        dataTypes: {
          roomId: typeof data.roomId,
          hostId: typeof data.hostId,
          dungeonId: typeof data.dungeonId,
        },
      });

      const roomInfo = await this.roomLobbyService.updateDungeon(
        data.roomId,
        data.hostId,
        data.dungeonId,
      );

      // Notify all players in room about dungeon change
      console.log(
        '[GATEWAY] Emitting roomUpdated event to room:',
        data.roomId,
        'with dungeon:',
        roomInfo.dungeonId,
      );
      this.server.to(`room_${data.roomId}`).emit('roomUpdated', roomInfo);

      return { success: true, roomInfo };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @SubscribeMessage('kickPlayer')
  async handleKickPlayer(
    @MessageBody() data: { roomId: number; hostId: number; playerId: number },
  ) {
    try {
      console.log('[GATEWAY KICK PLAYER DEBUG]', {
        receivedData: data,
        dataTypes: {
          roomId: typeof data.roomId,
          hostId: typeof data.hostId,
          playerId: typeof data.playerId,
        },
      });

      const result = await this.roomLobbyService.kickPlayer(
        data.roomId,
        data.hostId,
        data.playerId,
      );

      // Get updated room info
      const roomInfo = await this.roomLobbyService.getRoomInfo(data.roomId);

      // Notify all players in room about player kick
      this.server.to(`room_${data.roomId}`).emit('roomUpdated', roomInfo);

      // Notify the kicked player specifically
      this.server.to(`room_${data.roomId}`).emit('playerKicked', {
        kickedPlayerId: data.playerId,
        message: result.message,
      });

      return { success: true, result, roomInfo };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
