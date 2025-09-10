import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WorldBossService } from './world-boss.service';
import { AttackBossDto } from './world-boss.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/world-boss',
})
export class WorldBossGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<number, Socket>();

  constructor(private readonly worldBossService: WorldBossService) {}

  async handleConnection(client: Socket) {
    try {
      const userId = client.handshake.query.userId as string;
      if (userId) {
        this.connectedClients.set(parseInt(userId), client);

        // Send current boss status to new client
        const currentBoss = await this.worldBossService.getCurrentBoss();
        if (currentBoss) {
          client.emit('bossUpdate', currentBoss);
        }
      }
    } catch (error) {
      console.error('World Boss Gateway connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Remove client from connected clients
    for (const [userId, socket] of this.connectedClients.entries()) {
      if (socket.id === client.id) {
        this.connectedClients.delete(userId);
        break;
      }
    }
  }

  @SubscribeMessage('attackBoss')
  async handleAttackBoss(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AttackBossDto,
  ) {
    try {
      const userId = client.handshake.query.userId as string;
      if (!userId) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

      const userIdNum = parseInt(userId);
      const result = await this.worldBossService.attackBoss(userIdNum, data);

      // Send result to the attacking player
      client.emit('attackResult', result);

      // Broadcast boss update to all connected clients
      const currentBoss = await this.worldBossService.getCurrentBoss();
      if (currentBoss) {
        this.server.emit('bossUpdate', currentBoss);
      }

      // If boss died, broadcast respawn info
      if (result.isBossDead) {
        this.server.emit('bossDefeated', {
          nextRespawnTime: result.nextRespawnTime,
          rewards: result.rewards,
        });
      }
    } catch (error) {
      console.error('Attack boss error:', error);
      client.emit('error', { message: error.message || 'Attack failed' });
    }
  }

  @SubscribeMessage('getBossStatus')
  async handleGetBossStatus(@ConnectedSocket() client: Socket) {
    try {
      const currentBoss = await this.worldBossService.getCurrentBoss();
      client.emit('bossUpdate', currentBoss);
    } catch (error) {
      console.error('Get boss status error:', error);
      client.emit('error', { message: 'Failed to get boss status' });
    }
  }

  @SubscribeMessage('getBossRankings')
  async handleGetBossRankings(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bossId: number },
  ) {
    try {
      const rankings = await this.worldBossService.getBossRankings(data.bossId);
      client.emit('bossRankings', rankings);
    } catch (error) {
      console.error('Get boss rankings error:', error);
      client.emit('error', { message: 'Failed to get boss rankings' });
    }
  }

  // Method to broadcast boss updates from service
  async broadcastBossUpdate(bossData: any) {
    this.server.emit('bossUpdate', bossData);
  }

  // Method to broadcast boss defeat
  async broadcastBossDefeat(
    bossId: number,
    nextRespawnTime: Date,
    rewards: any,
  ) {
    this.server.emit('bossDefeated', {
      bossId,
      nextRespawnTime,
      rewards,
    });
  }

  // Method to broadcast new boss spawn
  async broadcastNewBossSpawn(bossData: any) {
    this.server.emit('newBossSpawn', bossData);
  }
}
