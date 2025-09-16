/* eslint-disable @typescript-eslint/no-floating-promises */
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
import { Injectable, UseGuards, Logger, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoomLobbyService } from './room-lobby.service';
import { REDIS_CLIENT } from '../common/redis.provider';
import Redis from 'ioredis';
import { combatQueue } from '../queues/combat.queue';

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

  constructor(
    private roomLobbyService: RoomLobbyService,
    @Inject(REDIS_CLIENT) private readonly redisClient?: Redis,
  ) {
    // subscribe to combat results published by worker (best-effort, resilient)
    if (this.redisClient) {
      (async () => {
        const sub = this.redisClient.duplicate();
        sub.on('error', (err) => {
          this.logger.warn(`Redis subscriber error: ${err?.message || err}`);
        });

        try {
          try {
            // attempt to connect, but ignore "already connecting/connected" errors
            if (typeof sub.connect === 'function') {
              if (sub.status !== 'connecting' && sub.status !== 'ready') {
                // connect may throw if already connecting; catch below

                await sub.connect();
              }
            }
          } catch (innerErr) {
            const msg = (innerErr as any)?.message || innerErr;
            if (!/already connecting|already connected/i.test(String(msg))) {
              this.logger.warn(
                'Error while connecting redis subscriber: ' + msg,
              );
            }
          }

          // subscribe and listen for messages
          // ioredis emits 'message' with (channel, message)
          // we intentionally don't await subscribe result here; handle messages as they arrive

          await sub.subscribe('combat:result');
          sub.on('message', (_channel: string, message: string) => {
            this.logger.log('[Redis] combat:result message received');
            void (async () => {
              try {
                const payload = JSON.parse(message as string);
                const roomId = payload.roomId;
                const result = payload.result;

                // Debug: Count clients in room before emitting
                const roomName = `room_${roomId}`;
                const socketIdSet = await this.server.in(roomName).allSockets();
                const socketIds = Array.from(socketIdSet || []);
                const clientsCount = socketIds.length;

                this.logger.log(
                  `[Emit Debug] Emitting combatResult to ${roomName}, clients count: ${clientsCount}`,
                );
                this.logger.log(
                  `[Emit Debug] Socket IDs: ${socketIds.join(', ')}`,
                );

                // Debug: Check each socket's data
                for (const socketId of socketIds) {
                  const socket = this.server?.sockets?.sockets?.get(socketId);
                  const socketData = (socket?.data as any) || {};
                  this.logger.log(
                    `[Emit Debug] socket ${socketId} data:`,
                    socketData,
                  );
                }

                this.server
                  .to(`room_${roomId}`)
                  .emit('combatResult', { roomId, result });
                this.logger.log(
                  `[Redis] combatResult emitted to room_${roomId}`,
                );
                // After emitting combat result to clients, perform server-side cleanup
                // to reset player ready states and room status so every new combat
                // requires players to Ready again.
                try {
                  const updated = await this.roomLobbyService.postCombatCleanup(
                    roomId as number,
                  );
                  if (updated) {
                    this.server
                      .to(`room_${roomId}`)
                      .emit('roomUpdated', updated);
                  }
                } catch (e) {
                  this.logger.warn(
                    `postCombatCleanup failed for room ${roomId}: ${
                      (e as any)?.message || e
                    }`,
                  );
                }
              } catch (e) {
                this.logger.warn(
                  'Failed to parse combat result message: ' +
                    ((e as any)?.message || e),
                );
              }
            })();
          });
        } catch (e) {
          this.logger.warn(
            'Failed to setup redis subscription for combat:result: ' +
              ((e as any)?.message || e),
          );
        }
      })();
    }
  }

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

  async handleDisconnect(client: Socket) {
    this.logger.log(`Room client disconnected: ${client.id}`);

    try {
      const data = client.data as any;
      const userId: number | undefined = data?.userId;
      const roomId: number | undefined = data?.roomId;

      if (!userId || !roomId) return;

      // Check whether other sockets for this same user in the same room remain connected.
      const roomClients =
        this.server?.sockets?.adapter?.rooms?.get(`room_${roomId}`) ||
        new Set();

      let hostStillConnected = false;
      for (const socketId of roomClients) {
        const socket = this.server?.sockets?.sockets?.get(socketId);
        if (!socket) continue;
        const sData = (socket.data as any) || {};
        // If there is another socket for the same user in this room, host is still connected
        if (sData.userId === userId && socket.id !== client.id) {
          hostStillConnected = true;
          break;
        }
      }

      if (!hostStillConnected) {
        // Best-effort: if the disconnected user was the host of the room, cancel it so it won't remain active
        try {
          // Use getRoomInfo to verify host id and existence
          const roomInfo = await this.roomLobbyService.getRoomInfo(roomId);
          if (roomInfo && roomInfo.host && roomInfo.host.id === userId) {
            this.logger.log(
              `Host ${userId} disconnected from room ${roomId} — cancelling room`,
            );
            await this.roomLobbyService
              .cancelRoom(roomId, userId)
              .catch(() => {});

            // Notify any remaining clients in the room that it's closed/cancelled
            try {
              this.server.to(`room_${roomId}`).emit('roomClosed', {
                message: 'Host disconnected, room cancelled',
              });
            } catch (e) {
              // ignore emit errors
            }
          }
        } catch (err) {
          // ignore verification errors — this is best-effort cleanup
          this.logger.warn(
            `Error while verifying/cancelling room ${roomId} for host ${userId}: ${err?.message || err}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Error in handleDisconnect cleanup: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: number; userId: number; password?: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      console.log(
        `[Socket] Client ${client.id} attempting to join room_${data.roomId} for user ${data.userId}`,
      );

      // Forward password (if any) from socket payload to the service so
      // password-protected rooms behave the same via socket and REST.
      const joinResult = await this.roomLobbyService.joinRoom(
        data.roomId,
        data.userId,
        data.password,
      );

      // joinResult now includes { roomInfo, affectedRoomIds }
      const roomInfo = joinResult && (joinResult as any).roomInfo;
      const affectedRoomIds: number[] =
        (joinResult && (joinResult as any).affectedRoomIds) || [];

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

      // Update player's lastSeen timestamp so server-side cleanup knows this
      try {
        await this.roomLobbyService.touchPlayer(data.roomId, data.userId);
      } catch (e) {
        this.logger.warn(
          `Failed to touchPlayer for ${data.userId} in room ${data.roomId}: ${e?.message || e}`,
        );
      }

      // Verify client is in room using allSockets() so counts are adapter-aware.
      try {
        const roomName = `room_${data.roomId}`;
        const socketIdSet = await this.server.in(roomName).allSockets();
        const ids = Array.from(socketIdSet || []);
        console.log(
          `[Socket] Room ${data.roomId} now has ${ids.length} clients:`,
          ids.map((id) => {
            const socket = this.server?.sockets?.sockets?.get(id);
            return {
              socketId: id,
              userId: (socket?.data as any)?.userId || 'unknown',
            };
          }),
        );
      } catch (e) {
        console.log(
          `[Socket] Failed to inspect room clients for ${data.roomId}:`,
          e?.message || e,
        );
      }

      // Notify all players in room about the new player
      this.server.to(`room_${data.roomId}`).emit('roomUpdated', roomInfo);

      // Emit updates for any rooms that were affected by atomic removal
      for (const rid of affectedRoomIds) {
        try {
          const info = await this.roomLobbyService.getRoomInfo(rid);
          this.server.to(`room_${rid}`).emit('roomUpdated', info);
        } catch (e) {
          // If room got deleted, emit roomClosed to that room namespace
          this.server.to(`room_${rid}`).emit('roomClosed', {
            message: 'Room closed due to host change or no active players',
          });
        }
      }

      // Emit explicit acknowledgement to the joining client so frontend can confirm
      try {
        const roomName = `room_${data.roomId}`;
        const socketIdSet = await this.server.in(roomName).allSockets();
        const ids = Array.from(socketIdSet || []);
        const clientsCount = ids.length;
        client.emit('joinedRoom', {
          roomId: data.roomId,
          socketId: client.id,
          clientsCount,
        });
        this.logger.log(
          `[Join Debug] Emitted joinedRoom to ${client.id} for ${roomName}, clientsCount=${clientsCount}`,
        );
      } catch (e) {
        this.logger.warn(
          'Failed to emit joinedRoom ack: ' + ((e as any)?.message || e),
        );
      }

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

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @MessageBody() data: { roomId: number; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      await this.roomLobbyService.touchPlayer(data.roomId, data.userId);
      return { success: true };
    } catch (e) {
      this.logger.warn(
        `heartbeat failed for room ${data?.roomId} user ${data?.userId}: ${e?.message || e}`,
      );
      return { success: false };
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

      // If after this toggle all non-host active players are READY, auto-start the combat
      try {
        // Consider active players any player who hasn't LEFT the room.
        // Coerce enum/status to string for a safe comparison with string literal
        const activePlayers = room.players.filter(
          (p) => String(p.status) !== 'LEFT',
        );
        // Players not ready are active players (except host) who do not have isReady === true
        const playersNotReady = activePlayers.filter(
          (p) => p.id !== room.host.id && p.isReady !== true,
        );

        if (playersNotReady.length === 0) {
          // mark room as STARTING using service validation and enqueue job
          try {
            const prep = await this.roomLobbyService.prepareStartCombat(
              data.roomId,
              room.host.id,
            );

            const job = await combatQueue.add(
              'startCombat',
              {
                roomId: data.roomId,
                userIds: prep.userIds,
                dungeonId: prep.dungeonId,
              },
              { removeOnComplete: true, attempts: 3 },
            );

            this.server
              .to(`room_${data.roomId}`)
              .emit('combatEnqueued', { jobId: job.id });
          } catch (e) {
            // ignore errors here; toggleReady already succeeded and we'll rely on host/manual start
            this.logger.warn(
              'Auto-start attempt failed for room ' +
                String(data.roomId) +
                ': ' +
                ((e as any)?.message || e),
            );
          }
        }
      } catch (e) {
        // continue silently on unexpected errors
      }

      return { success: true, roomInfo: room };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('[TOGGLE READY] Error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  @SubscribeMessage('prepareStart')
  async handlePrepareStart(
    @MessageBody() data: { roomId: number; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Verify host
      const roomInfo = await this.roomLobbyService.getRoomInfo(data.roomId);
      if (!roomInfo) {
        return { success: false, error: 'Room not found' };
      }

      if (roomInfo.host.id !== data.userId) {
        return { success: false, error: 'Only host can prepare start' };
      }

      // Broadcast a prepare-to-start event to all players in the room so clients
      // can show a readiness modal with current ready status
      try {
        this.server.to(`room_${data.roomId}`).emit('prepareToStart', roomInfo);
        // Also emit directly to the requesting client to ensure the host
        // sees the prepare modal even if their socket hasn't joined the room
        try {
          client.emit('prepareToStart', roomInfo);
        } catch (e) {
          // ignore
        }
      } catch (e) {
        this.logger.warn(
          `Failed to emit prepareToStart for room ${data.roomId}: ${e?.message || e}`,
        );
      }

      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  @SubscribeMessage('startCombat')
  async handleStartCombat(
    @MessageBody() data: { roomId: number; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Server-side validation: ensure readiness and mark room as STARTING
      const prep = await this.roomLobbyService.prepareStartCombat(
        data.roomId,
        data.userId,
      );

      // Enqueue combat job to BullMQ worker using validated payload
      const job = await combatQueue.add(
        'startCombat',
        {
          roomId: data.roomId,
          userIds: prep.userIds,
          dungeonId: prep.dungeonId,
        },
        {
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      );

      // notify client that job is accepted
      client.emit('combatEnqueued', { jobId: job.id });
      return { success: true, jobId: job.id };
    } catch (error) {
      console.error(
        `[Socket] Failed to enqueue combat for room ${data.roomId}:`,
        error,
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
