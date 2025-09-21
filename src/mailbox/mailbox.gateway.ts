import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { UsersService } from '../users/users.service';

@WebSocketGateway({ namespace: '/mailbox', cors: { origin: '*' } })
@Injectable()
export class MailboxGateway implements OnGatewayConnection {
  private readonly logger = new Logger(MailboxGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly usersService: UsersService) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      try {
        client.disconnect(true);
      } catch (e) {
        this.logger.debug('Failed to disconnect unauthenticated socket', e);
      }
      return;
    }

    let decoded: unknown;
    try {
      decoded = verify(token, process.env.JWT_SECRET || '');
    } catch (err) {
      this.logger.error('Socket auth failed during token verify', err);
      try {
        client.disconnect(true);
      } catch (e) {
        this.logger.debug('Failed to disconnect after token verify failure', e);
      }
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const userId = (decoded as any).sub as number | undefined;
    if (!userId) {
      try {
        client.disconnect(true);
      } catch (e) {
        this.logger.debug('Failed to disconnect socket with missing userId', e);
      }
      return;
    }

    void client.join(`user_${userId}`);
    this.logger.debug(`Socket connected and joined user_${userId}`);
  }

  emitMailReceived(userId: number, mailId: number) {
    try {
      this.server.to(`user_${userId}`).emit('mailReceived', { mailId });
    } catch (err) {
      this.logger.error('Failed to emit mailReceived', err);
    }
  }

  emitUnreadCount(userId: number, count: number) {
    try {
      this.server.to(`user_${userId}`).emit('mailUnreadCount', { count });
    } catch (err) {
      this.logger.error('Failed to emit mailUnreadCount', err);
    }
  }

  // Emit advancement pending notification to a specific user room
  emitAdvancementPending(userId: number, pending: unknown) {
    try {
      this.server.to(`user_${userId}`).emit('advancement:pending', pending);
    } catch (err) {
      this.logger.error('Failed to emit advancement:pending', err);
    }
  }

  // Emit advancement applied notification to a specific user room
  emitAdvancementApplied(userId: number, payload: unknown) {
    try {
      this.server.to(`user_${userId}`).emit('advancement:applied', payload);
    } catch (err) {
      this.logger.error('Failed to emit advancement:applied', err);
    }
  }
}
