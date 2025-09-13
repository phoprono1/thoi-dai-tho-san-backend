import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RoomLobby,
  RoomPlayer,
  RoomStatus,
  PlayerStatus,
} from './room-lobby.entity';
import { User } from '../users/user.entity';
import { Dungeon } from '../dungeons/dungeon.entity';
import { CombatResultsService } from '../combat-results/combat-results.service';
import { UserItemsService } from '../user-items/user-items.service';

@Injectable()
export class RoomLobbyService {
  constructor(
    @InjectRepository(RoomLobby)
    private roomLobbyRepository: Repository<RoomLobby>,
    @InjectRepository(RoomPlayer)
    private roomPlayerRepository: Repository<RoomPlayer>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Dungeon)
    private dungeonsRepository: Repository<Dungeon>,
    private combatResultsService: CombatResultsService,
    private userItemsService: UserItemsService,
  ) {}

  async createRoom(
    hostId: number,
    dungeonId: number,
    name: string,
    isPrivate: boolean = false,
    password?: string,
    minPlayers: number = 1,
    maxPlayers: number = 4,
  ) {
    // Kiểm tra host tồn tại
    const host = await this.usersRepository.findOne({ where: { id: hostId } });
    if (!host) {
      throw new BadRequestException('Người chơi không tồn tại');
    }

    // Kiểm tra dungeon tồn tại
    const dungeon = await this.dungeonsRepository.findOne({
      where: { id: dungeonId },
    });
    if (!dungeon) {
      throw new BadRequestException('Hầm ngục không tồn tại');
    }

    // Kiểm tra level requirement
    if (host.level < dungeon.levelRequirement) {
      throw new BadRequestException('Level không đủ để vào hầm ngục này');
    }

    // Nếu dungeon yêu cầu vật phẩm, kiểm tra và tiêu thụ 1 cái
    if (dungeon.requiredItem) {
      try {
        const userItem = await this.userItemsService.findByUserAndItem(
          hostId,
          dungeon.requiredItem,
        );

        if (!userItem || (userItem.quantity || 0) <= 0) {
          throw new BadRequestException('Thiếu vật phẩm để vào hầm ngục');
        }

        const removed = await this.userItemsService.removeItemFromUser(
          hostId,
          dungeon.requiredItem,
          1,
        );

        if (!removed) {
          throw new BadRequestException('Không thể tiêu thụ vật phẩm yêu cầu');
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Không thể kiểm tra vật phẩm yêu cầu');
      }
    }

    // Tạo phòng
    const room = this.roomLobbyRepository.create({
      name,
      host,
      hostId,
      dungeon,
      dungeonId,
      isPrivate,
      password,
      minPlayers,
      maxPlayers,
    });

    const savedRoom = await this.roomLobbyRepository.save(room);

    // Tự động thêm host vào phòng as player
    const hostPlayer = this.roomPlayerRepository.create({
      room: savedRoom,
      roomId: savedRoom.id,
      player: host,
      playerId: host.id,
      status: PlayerStatus.JOINED,
    });

    await this.roomPlayerRepository.save(hostPlayer);

    return this.roomLobbyRepository.findOne({
      where: { id: savedRoom.id },
      relations: ['host', 'dungeon', 'players', 'players.player'],
    });
  }

  async joinRoom(roomId: number, playerId: number, password?: string) {
    console.log(
      `[JOIN ROOM] Request: roomId=${roomId}, playerId=${playerId}, password=${password ? '[PROVIDED]' : '[NOT PROVIDED]'}`,
    );

    // Kiểm tra player tồn tại
    const player = await this.usersRepository.findOne({
      where: { id: playerId },
    });
    if (!player) {
      console.log(`[JOIN ROOM] Error: Player ${playerId} not found`);
      throw new BadRequestException('Người chơi không tồn tại');
    }
    console.log(
      `[JOIN ROOM] Found player: ${player.username} (level ${player.level})`,
    );

    // Kiểm tra phòng tồn tại
    const room = await this.roomLobbyRepository.findOne({
      where: { id: roomId },
      relations: ['host', 'dungeon', 'players'],
    });
    if (!room) {
      throw new NotFoundException('Phòng không tồn tại');
    }

    // Kiểm tra trạng thái phòng
    if (room.status !== RoomStatus.WAITING) {
      throw new BadRequestException('Phòng không thể tham gia');
    }

    // Kiểm tra mật khẩu nếu phòng private
    if (room.isPrivate && room.password !== password) {
      throw new BadRequestException('Mật khẩu không đúng');
    }

    // Kiểm tra level requirement
    if (player.level < room.dungeon.levelRequirement) {
      throw new BadRequestException('Level không đủ để vào hầm ngục này');
    }

    // Kiểm tra số lượng người chơi
    if (room.players.length >= room.maxPlayers) {
      throw new BadRequestException('Phòng đã đầy');
    }

    // Kiểm tra player đã trong phòng chưa
    const existingPlayer = room.players.find((p) => p.playerId === playerId);
    if (
      existingPlayer &&
      (existingPlayer.status === PlayerStatus.JOINED ||
        existingPlayer.status === PlayerStatus.READY)
    ) {
      // Nếu đã trong phòng, chỉ trả về thông tin phòng mà không báo lỗi
      return this.roomLobbyRepository.findOne({
        where: { id: roomId },
        relations: ['host', 'dungeon', 'players', 'players.player'],
      });
    }

    // Nếu player đã có trong phòng nhưng status là LEFT hoặc INVITED, cho phép join lại
    if (
      existingPlayer &&
      (existingPlayer.status === PlayerStatus.LEFT ||
        existingPlayer.status === PlayerStatus.INVITED)
    ) {
      existingPlayer.status = PlayerStatus.JOINED;
      // Không cần set leftAt vì nó sẽ giữ giá trị cũ hoặc null
      await this.roomPlayerRepository.save(existingPlayer);

      return this.roomLobbyRepository.findOne({
        where: { id: roomId },
        relations: ['host', 'dungeon', 'players', 'players.player'],
      });
    }

    // Thêm player vào phòng
    // Nếu dungeon yêu cầu vật phẩm, kiểm tra và tiêu thụ 1 cái trước khi thêm
    if (
      room.dungeon &&
      (room.dungeon.requiredItem || room.dungeon.requiredItem === 0)
    ) {
      try {
        const required = room.dungeon.requiredItem;
        if (required) {
          const userItem = await this.userItemsService.findByUserAndItem(
            playerId,
            required,
          );
          if (!userItem || (userItem.quantity || 0) <= 0) {
            throw new BadRequestException('Thiếu vật phẩm để vào hầm ngục');
          }
          const removed = await this.userItemsService.removeItemFromUser(
            playerId,
            required,
            1,
          );
          if (!removed) {
            throw new BadRequestException(
              'Không thể tiêu thụ vật phẩm yêu cầu',
            );
          }
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Không thể kiểm tra vật phẩm yêu cầu');
      }
    }

    const roomPlayer = this.roomPlayerRepository.create({
      room,
      roomId,
      player,
      playerId,
      status: PlayerStatus.JOINED,
    });

    await this.roomPlayerRepository.save(roomPlayer);

    return this.roomLobbyRepository.findOne({
      where: { id: roomId },
      relations: ['host', 'dungeon', 'players', 'players.player'],
    });
  }

  async leaveRoom(roomId: number, playerId: number) {
    const roomPlayer = await this.roomPlayerRepository.findOne({
      where: { roomId, playerId },
      relations: ['room'],
    });

    if (!roomPlayer) {
      throw new BadRequestException('Bạn không ở trong phòng này');
    }

    // Nếu là host, hủy phòng
    if (roomPlayer.room.hostId === playerId) {
      await this.cancelRoom(roomId, playerId);
      return { message: 'Đã hủy phòng' };
    }

    // Cập nhật trạng thái player
    roomPlayer.status = PlayerStatus.LEFT;
    roomPlayer.leftAt = new Date();
    await this.roomPlayerRepository.save(roomPlayer);

    return { message: 'Đã rời phòng' };
  }

  async startCombat(roomId: number, hostId: number) {
    console.log(
      `[RoomService] Starting combat for room ${roomId}, host ${hostId}`,
    );

    // Kiểm tra quyền host
    const room = await this.roomLobbyRepository.findOne({
      where: { id: roomId },
      relations: ['host', 'dungeon', 'players', 'players.player'],
    });

    if (!room) {
      throw new NotFoundException('Phòng không tồn tại');
    }

    console.log(
      `[RoomService] Room found: id=${room.id}, status=${room.status}, hostId=${room.hostId}, playersCount=${room.players.length}`,
    );

    if (room.hostId !== hostId) {
      throw new BadRequestException('Chỉ host mới có thể bắt đầu');
    }

    if (room.status !== RoomStatus.WAITING) {
      console.log(`[RoomService] Room status is not WAITING: ${room.status}`);
      throw new BadRequestException('Phòng không thể bắt đầu');
    }

    // Lấy danh sách players đang active
    const activePlayers = room.players.filter(
      (p) =>
        p.status === PlayerStatus.JOINED || p.status === PlayerStatus.READY,
    );

    console.log(
      `[RoomService] Active players: ${activePlayers.length}, Min players: ${room.minPlayers}`,
    );
    console.log(
      `[RoomService] Player statuses:`,
      activePlayers.map((p) => ({
        id: p.playerId,
        status: p.status,
        name: p.player?.username || 'unknown',
      })),
    );

    if (activePlayers.length < room.minPlayers) {
      throw new BadRequestException(
        `Cần ít nhất ${room.minPlayers} người chơi để bắt đầu`,
      );
    }

    // Kiểm tra tất cả players đã sẵn sàng chưa (trừ host)
    const playersNotReady = activePlayers.filter(
      (p) => p.status !== PlayerStatus.READY && p.playerId !== hostId,
    );

    console.log(
      `[RoomService] Players not ready:`,
      playersNotReady.map((p) => ({
        id: p.playerId,
        status: p.status,
        name: p.player?.username || 'unknown',
      })),
    );

    if (playersNotReady.length > 0) {
      const notReadyNames = playersNotReady
        .map((p) => p.player.username)
        .join(', ');
      throw new BadRequestException(
        `Một số người chơi chưa sẵn sàng: ${notReadyNames}`,
      );
    }

    // Cập nhật trạng thái phòng
    room.status = RoomStatus.STARTING;
    await this.roomLobbyRepository.save(room);

    // Lấy user IDs
    const userIds = activePlayers.map((p) => p.playerId);

    try {
      // Bắt đầu combat
      const combatResult = await this.combatResultsService.startCombat(
        userIds,
        room.dungeonId,
      );

      // Cập nhật trạng thái phòng
      room.status = RoomStatus.IN_COMBAT;
      const savedRoom = await this.roomLobbyRepository.save(room);

      return {
        room: savedRoom,
        combatResult,
        message: 'Đã bắt đầu trận chiến!',
      };
    } catch (error) {
      // Reset trạng thái phòng nếu có lỗi
      room.status = RoomStatus.WAITING;
      await this.roomLobbyRepository.save(room);
      throw error;
    }
  }

  async cancelRoom(roomId: number, hostId: number) {
    const room = await this.roomLobbyRepository.findOne({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Phòng không tồn tại');
    }

    if (room.hostId !== hostId) {
      throw new BadRequestException('Chỉ host mới có thể hủy phòng');
    }

    // Cập nhật trạng thái tất cả players
    await this.roomPlayerRepository.update(
      { roomId },
      { status: PlayerStatus.LEFT, leftAt: new Date() },
    );

    // Cập nhật trạng thái phòng
    room.status = RoomStatus.CANCELLED;
    await this.roomLobbyRepository.save(room);

    return { message: 'Đã hủy phòng' };
  }

  async getRoomList(dungeonId?: number, status?: RoomStatus) {
    const query = this.roomLobbyRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.host', 'host')
      .leftJoinAndSelect('room.dungeon', 'dungeon')
      .leftJoinAndSelect(
        'room.players',
        'players',
        'players.status IN (:...statuses)',
        {
          statuses: [PlayerStatus.JOINED, PlayerStatus.READY],
        },
      )
      .leftJoinAndSelect('players.player', 'player')
      .where('room.isPrivate = :isPrivate', { isPrivate: false });

    // By default, exclude cancelled rooms from the public room list.
    // If an explicit status filter is provided, respect it.
    if (!status) {
      query.andWhere('room.status != :cancelled', {
        cancelled: RoomStatus.CANCELLED,
      });
    }

    if (dungeonId) {
      query.andWhere('room.dungeonId = :dungeonId', { dungeonId });
    }

    if (status) {
      query.andWhere('room.status = :status', { status });
    }

    query.orderBy('room.createdAt', 'DESC');

    const rooms = await query.getMany();

    // Add currentPlayers count to each room
    return rooms.map((room) => ({
      ...room,
      currentPlayers: room.players
        ? room.players.filter(
            (p) =>
              p.status === PlayerStatus.JOINED ||
              p.status === PlayerStatus.READY,
          ).length
        : 0,
    }));
  }

  async getRoomById(roomId: number) {
    const room = await this.roomLobbyRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.host', 'host')
      .leftJoinAndSelect('room.dungeon', 'dungeon')
      .leftJoinAndSelect(
        'room.players',
        'players',
        'players.status IN (:...statuses)',
        {
          statuses: [PlayerStatus.JOINED, PlayerStatus.READY],
        },
      )
      .leftJoinAndSelect('players.player', 'player')
      .where('room.id = :roomId', { roomId })
      .getOne();

    if (!room) {
      throw new Error('Room not found');
    }

    // Add currentPlayers count
    return {
      ...room,
      currentPlayers: room.players
        ? room.players.filter(
            (p) =>
              p.status === PlayerStatus.JOINED ||
              p.status === PlayerStatus.READY,
          ).length
        : 0,
    };
  }

  async getRoomByHostId(hostId: number) {
    const room = await this.roomLobbyRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.host', 'host')
      .leftJoinAndSelect('room.dungeon', 'dungeon')
      .leftJoinAndSelect(
        'room.players',
        'players',
        'players.status IN (:...statuses)',
        {
          statuses: [PlayerStatus.JOINED, PlayerStatus.READY],
        },
      )
      .leftJoinAndSelect('players.player', 'player')
      .where('room.hostId = :hostId', { hostId })
      .andWhere('room.status IN (:...roomStatuses)', {
        roomStatuses: [RoomStatus.WAITING, RoomStatus.IN_COMBAT],
      })
      .orderBy('room.createdAt', 'DESC')
      .getOne();

    if (room) {
      // Add currentPlayers count
      return {
        ...room,
        currentPlayers: room.players
          ? room.players.filter(
              (p) =>
                p.status === PlayerStatus.JOINED ||
                p.status === PlayerStatus.READY,
            ).length
          : 0,
      };
    }

    return null;
  }

  async invitePlayer(roomId: number, hostId: number, playerId: number) {
    // Kiểm tra quyền host
    const room = await this.roomLobbyRepository.findOne({
      where: { id: roomId },
    });

    if (!room || room.hostId !== hostId) {
      throw new BadRequestException('Không có quyền mời người chơi');
    }

    // Kiểm tra player tồn tại
    const player = await this.usersRepository.findOne({
      where: { id: playerId },
    });
    if (!player) {
      throw new BadRequestException('Người chơi không tồn tại');
    }

    // Kiểm tra player đã trong phòng chưa
    const existingPlayer = await this.roomPlayerRepository.findOne({
      where: { roomId, playerId },
    });

    if (existingPlayer) {
      throw new BadRequestException('Người chơi đã ở trong phòng');
    }

    // Tạo invitation
    const roomPlayer = this.roomPlayerRepository.create({
      room,
      roomId,
      player,
      playerId,
      status: PlayerStatus.INVITED,
    });

    await this.roomPlayerRepository.save(roomPlayer);

    return { message: 'Đã gửi lời mời' };
  }

  async resetRoom(roomId: number, hostId: number) {
    // Kiểm tra quyền host
    const room = await this.roomLobbyRepository.findOne({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Phòng không tồn tại');
    }

    if (room.hostId !== hostId) {
      throw new BadRequestException('Chỉ host mới có thể reset phòng');
    }

    // Reset room status về WAITING
    room.status = RoomStatus.WAITING;
    await this.roomLobbyRepository.save(room);

    return {
      message: 'Phòng đã được reset về trạng thái chờ',
      room: {
        id: room.id,
        status: room.status,
      },
    };
  }

  async togglePlayerReady(roomId: number, playerId: number) {
    console.log(
      `[SERVICE] Toggle ready - Room: ${roomId}, Player: ${playerId}`,
    );

    // Find the room player (không giới hạn status)
    const roomPlayer = await this.roomPlayerRepository.findOne({
      where: { roomId, playerId },
    });

    if (!roomPlayer) {
      throw new BadRequestException('Người chơi không trong phòng');
    }

    console.log(
      `[SERVICE] Current player status: ${roomPlayer.status}, isReady: ${roomPlayer.isReady}`,
    );

    // Chỉ cho phép toggle ready nếu player đang JOINED hoặc READY
    if (
      roomPlayer.status !== PlayerStatus.JOINED &&
      roomPlayer.status !== PlayerStatus.READY
    ) {
      throw new BadRequestException('Người chơi chưa tham gia phòng');
    }

    // Toggle ready status
    roomPlayer.isReady = !roomPlayer.isReady;

    // Cập nhật status thành READY hoặc JOINED dựa vào isReady
    roomPlayer.status = roomPlayer.isReady
      ? PlayerStatus.READY
      : PlayerStatus.JOINED;

    console.log(
      `[SERVICE] After toggle - status: ${roomPlayer.status}, isReady: ${roomPlayer.isReady}`,
    );

    await this.roomPlayerRepository.save(roomPlayer);

    // Return room info
    const roomInfo = await this.getRoomInfo(roomId);
    console.log(
      '[SERVICE] Room info after toggle:',
      roomInfo.players.map((p) => ({
        username: p.username,
        status: p.status,
        isReady: p.isReady,
      })),
    );
    return roomInfo;
  }

  async removePlayerFromRoom(roomId: number, playerId: number) {
    // Find and remove the room player
    const roomPlayer = await this.roomPlayerRepository.findOne({
      where: { roomId, playerId },
    });

    if (roomPlayer) {
      await this.roomPlayerRepository.remove(roomPlayer);
    }

    // Check if room is empty (except host)
    const remainingPlayers = await this.roomPlayerRepository.find({
      where: { roomId },
    });

    if (remainingPlayers.length === 0) {
      // Delete the room if no players left
      await this.roomLobbyRepository.delete(roomId);
    }

    return { message: 'Đã rời khỏi phòng' };
  }

  async getRoomInfo(roomId: number) {
    // Get room with basic info only (no dungeon relation)
    const room = await this.roomLobbyRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.host', 'host')
      .where('room.id = :roomId', { roomId })
      .getOne();

    if (!room) {
      throw new NotFoundException('Phòng không tồn tại');
    }

    // Fetch dungeon separately using the dungeonId
    const dungeon = await this.dungeonsRepository.findOne({
      where: { id: room.dungeonId },
    });

    const players = await this.roomPlayerRepository.find({
      where: { roomId },
      relations: ['player'],
      order: { joinedAt: 'ASC' },
    });

    console.log('[GET ROOM INFO DEBUG]', {
      roomId,
      dungeonId: room.dungeonId,
      dungeonFromSeparateQuery: dungeon
        ? { id: dungeon.id, name: dungeon.name }
        : null,
    });

    return {
      id: room.id,
      name: room.name,
      dungeonId: room.dungeonId,
      dungeonName: dungeon?.name,
      maxPlayers: room.maxPlayers,
      status: room.status,
      host: {
        id: room.host.id,
        username: room.host.username,
      },
      players: players.map((p) => ({
        id: p.player.id,
        username: p.player.username,
        status: p.status,
        isReady: p.isReady,
        joinedAt: p.joinedAt,
      })),
      createdAt: room.createdAt,
    };
  }

  async updateDungeon(roomId: number, hostId: number, dungeonId: number) {
    console.log('[UPDATE DUNGEON DEBUG]', {
      roomId,
      hostId,
      dungeonId,
      roomHostId: 'will check after query',
      isHostMatch: 'will check after query',
    });

    const room = await this.roomLobbyRepository.findOne({
      where: { id: roomId },
      relations: ['host', 'dungeon'],
    });

    if (!room) {
      throw new NotFoundException('Phòng không tồn tại');
    }

    console.log('[UPDATE DUNGEON DEBUG]', {
      roomId,
      hostId,
      dungeonId,
      roomHostId: room.hostId,
      isHostMatch: room.hostId === hostId,
    });

    if (room.hostId !== hostId) {
      throw new BadRequestException('Chỉ host mới có thể thay đổi dungeon');
    }

    if (room.status !== RoomStatus.WAITING) {
      throw new BadRequestException(
        'Chỉ có thể thay đổi dungeon khi phòng đang chờ',
      );
    }

    // Check if dungeon exists
    const dungeon = await this.dungeonsRepository.findOne({
      where: { id: dungeonId },
    });

    if (!dungeon) {
      throw new NotFoundException('Dungeon không tồn tại');
    }

    console.log('[UPDATE DUNGEON] Found dungeon:', {
      id: dungeon.id,
      name: dungeon.name,
    });

    console.log(
      '[UPDATE DUNGEON] Before update - Room dungeonId:',
      room.dungeonId,
    );

    // Update room dungeon
    room.dungeon = dungeon;
    room.dungeonId = dungeonId;
    const savedRoom = await this.roomLobbyRepository.save(room, {
      reload: true,
    });

    console.log(
      '[UPDATE DUNGEON] After save - Room dungeonId:',
      savedRoom.dungeonId,
    );

    // Return updated room info
    return this.getRoomInfo(roomId);
  }

  async kickPlayer(roomId: number, hostId: number, playerId: number) {
    const room = await this.roomLobbyRepository.findOne({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Phòng không tồn tại');
    }

    console.log('[KICK PLAYER DEBUG]', {
      roomId,
      hostId,
      playerId,
      roomHostId: room.hostId,
      isHostMatch: room.hostId === hostId,
    });

    if (room.hostId !== hostId) {
      throw new BadRequestException('Chỉ host mới có thể kick người chơi');
    }

    if (hostId === playerId) {
      throw new BadRequestException('Host không thể kick chính mình');
    }

    // Find the player in room
    const roomPlayer = await this.roomPlayerRepository.findOne({
      where: { roomId, playerId },
      relations: ['player'],
    });

    if (!roomPlayer) {
      throw new NotFoundException('Người chơi không có trong phòng này');
    }

    if (roomPlayer.status === PlayerStatus.LEFT) {
      throw new BadRequestException('Người chơi đã rời phòng');
    }

    // Update player status to LEFT
    roomPlayer.status = PlayerStatus.LEFT;
    roomPlayer.leftAt = new Date();
    await this.roomPlayerRepository.save(roomPlayer);

    return {
      message: `Đã kick ${roomPlayer.player.username} ra khỏi phòng`,
      kickedPlayer: {
        id: roomPlayer.player.id,
        username: roomPlayer.player.username,
      },
    };
  }
}
