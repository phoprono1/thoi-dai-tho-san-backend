/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-base-to-string */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { guildEvents } from './guild.events';
import { GuildInvitePayload } from './guild.events';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Guild,
  GuildMember,
  GuildEvent,
  GuildMemberRole,
  GuildStatus,
  GuildEventType,
  GuildEventStatus,
} from './guild.entity';
import { User } from '../users/user.entity';
import { Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../common/redis.provider';
import Redis from 'ioredis';

@Injectable()
export class GuildService {
  private readonly logger = new Logger(GuildService.name);
  constructor(
    @InjectRepository(Guild)
    private guildRepository: Repository<Guild>,
    @InjectRepository(GuildMember)
    private guildMemberRepository: Repository<GuildMember>,
    @InjectRepository(GuildEvent)
    private guildEventRepository: Repository<GuildEvent>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(REDIS_CLIENT) private readonly redisClient?: Redis,
    private readonly dataSource?: DataSource,
  ) {}

  // Tạo công hội mới
  async createGuild(
    userId: number,
    name: string,
    description?: string,
  ): Promise<Guild> {
    // We need an atomic operation: deduct 10_000 gold from the creator and create
    // the guild & leader member in a single transaction to avoid money-loss or
    // inconsistent state when errors occur.
    if (!this.dataSource) {
      this.logger.error('createGuild: DataSource is not initialized');
      throw new InternalServerErrorException(
        'Database connection not available',
      );
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Check if user already member (use transaction manager)
      const existingMember = await queryRunner.manager.findOne(GuildMember, {
        where: { userId },
      });
      if (existingMember) {
        // If the member points to a disbanded guild or the referenced guild
        // row no longer exists, treat it as stale and remove it decisively so
        // the user can create a new guild. Be tolerant: log failures but do
        // not throw generic Errors that become 500s — proceed with creation.
        const memberGuild = await queryRunner.manager.findOne(Guild, {
          where: { id: existingMember.guildId },
        });
        if (!memberGuild || memberGuild.status === GuildStatus.DISBANDED) {
          this.logger.debug(
            `createGuild: hard-deleting stale membership for user=${userId} guild=${existingMember.guildId}`,
          );

          // Try to delete the guild member row. If this fails, log and continue.
          try {
            await queryRunner.manager.delete(GuildMember, {
              id: existingMember.id,
            });
            this.logger.debug(
              `createGuild: deleted stale GuildMember id=${existingMember.id}`,
            );
          } catch (delErr) {
            this.logger.warn(
              `createGuild: failed to delete stale GuildMember id=${existingMember.id}`,
              delErr as any,
            );
          }

          // Attempt to clear user's guildId column; if this fails, log and continue.
          try {
            const userTable = this.userRepository.metadata.tableName;
            await queryRunner.manager.query(
              `UPDATE "${userTable}" SET "guildId" = NULL WHERE id = $1`,
              [userId],
            );
            this.logger.debug(
              `createGuild: cleared user.guildId for user=${userId}`,
            );
          } catch (updateErr) {
            this.logger.warn(
              `createGuild: failed to clear user.guildId for user=${userId}`,
              updateErr as any,
            );
          }

          // proceed with creation regardless of cleanup success
        } else {
          throw new BadRequestException(
            'Bạn đã là thành viên của một công hội khác',
          );
        }
      }

      // Check duplicate guild name
      const existingGuild = await queryRunner.manager.findOne(Guild, {
        where: { name },
      });
      if (existingGuild) {
        throw new BadRequestException('Tên công hội đã tồn tại');
      }

      const userTable = this.userRepository.metadata.tableName;
      // Lock the user row and read current gold using FOR UPDATE to avoid races
      const res: Array<{ id: number; gold: number }> =
        await queryRunner.manager.query(
          `SELECT id, gold FROM "${userTable}" WHERE id = $1 FOR UPDATE`,
          [userId],
        );
      if (!res || res.length === 0) {
        throw new NotFoundException('Người dùng không tồn tại');
      }
      const currentGold = Number(res[0].gold ?? 0);
      const cost = 10000;
      if (currentGold < cost) {
        throw new BadRequestException('Bạn cần 10.000 vàng để tạo công hội');
      }

      // Deduct gold from user
      const newGold = currentGold - cost;
      await queryRunner.manager.query(
        `UPDATE "${userTable}" SET "gold" = $1 WHERE id = $2`,
        [newGold, userId],
      );

      // Create guild
      const guild = queryRunner.manager.create(Guild, {
        name,
        description,
        leaderId: userId,
        maxMembers: 20,
        currentMembers: 1,
      });
      const savedGuild = await queryRunner.manager.save(guild);

      // Debug log để kiểm tra guild ID
      this.logger.debug(
        `createGuild: savedGuild.id=${savedGuild.id}, name=${savedGuild.name}`,
      );

      // Kiểm tra guild có thực sự tồn tại trong DB không
      const verifyGuild = await queryRunner.manager.findOne(Guild, {
        where: { id: savedGuild.id },
      });
      if (!verifyGuild) {
        this.logger.error(
          `createGuild: Guild với ID ${savedGuild.id} không tồn tại sau khi save`,
        );
        throw new InternalServerErrorException('Failed to create guild');
      }

      // Create leader member and mark approved
      const leaderMember = queryRunner.manager.create(GuildMember, {
        guildId: savedGuild.id,
        userId,
        role: GuildMemberRole.LEADER,
        isApproved: true,
      });
      await queryRunner.manager.save(leaderMember);

      // Update user's guildId column
      await queryRunner.manager.query(
        `UPDATE "${userTable}" SET "guildId" = $1 WHERE id = $2`,
        [savedGuild.id, userId],
      );

      await queryRunner.commitTransaction();
      return savedGuild;
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      const trace =
        err instanceof Error
          ? (err.stack ?? err.message)
          : typeof err === 'object'
            ? JSON.stringify(err)
            : String(err);
      this.logger.error(
        `createGuild failed user=${userId} name=${name}`,
        trace,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Invite broadcast: leader/deputy can broadcast an invite to world chat
  async inviteGuild(
    guildId: number,
    inviterId: number,
  ): Promise<GuildInvitePayload> {
    // Verify inviter is leader or deputy
    const inviter = await this.guildMemberRepository.findOne({
      where: { guildId, userId: inviterId },
    });
    if (
      !inviter ||
      (inviter.role !== GuildMemberRole.LEADER &&
        inviter.role !== GuildMemberRole.DEPUTY)
    ) {
      throw new ForbiddenException('Bạn không có quyền mời người chơi');
    }

    const guild = await this.guildRepository.findOne({
      where: { id: guildId },
    });
    if (!guild) throw new NotFoundException('Công hội không tồn tại');

    // Rate-limit invites per inviter: 1 invite per 30 seconds
    try {
      if (this.redisClient) {
        const key = `rl:guild:invite:${guildId}:${inviterId}`;
        const ttl = 30; // seconds
        const cur = await this.redisClient.get(key);
        if (cur) {
          throw new BadRequestException('Vui lòng chờ trước khi mời lại');
        }
        await this.redisClient.set(key, '1', 'EX', ttl);
      }
    } catch (e) {
      // If redis fails, fail-open but log
      this.logger.warn(
        'inviteGuild redis check failed',
        (e as Error).message || e,
      );
    }

    // Try to resolve inviter username quickly
    const user = await this.userRepository.findOne({
      where: { id: inviterId },
    });
    const payload: GuildInvitePayload = {
      guildId,
      guildName: guild.name,
      inviterId,
      inviterUsername: user?.username,
      timestamp: new Date().toISOString(),
    };

    // Emit event for other services (ChatGateway will listen and broadcast into world)
    try {
      guildEvents.emit('guildInvite', payload);
    } catch (e) {
      this.logger.warn('failed to emit guildInvite', e as any);
    }

    return payload;
  }

  // Xin vào công hội
  async requestJoinGuild(
    userId: number,
    guildId: number,
  ): Promise<GuildMember> {
    this.logger.debug(
      `requestJoinGuild: start user=${userId} guild=${guildId}`,
    );
    // Load the user to check guildId quickly
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    // Some User entity definitions don't expose guildId directly, query DB column
    try {
      const userTable = this.userRepository.metadata.tableName;
      const res: Array<{ guildId: number | null }> =
        await this.userRepository.manager.query(
          `SELECT "guildId" FROM "${userTable}" WHERE id = $1`,
          [userId],
        );
      if (res.length > 0 && res[0].guildId) {
        this.logger.debug(
          `requestJoinGuild: user ${userId} already has guildId=${res[0].guildId}`,
        );
        throw new BadRequestException(
          'Bạn đã là thành viên của một công hội khác',
        );
      }
    } catch (err) {
      // If the direct query fails for schema reasons, fall back to entity check
      this.logger.debug(
        'requestJoinGuild: fallback guild check failed query',
        err instanceof Error ? err.message : String(err),
      );
      let maybeGuild: unknown = undefined;
      if (
        typeof user === 'object' &&
        user !== null &&
        'guild' in (user as any)
      ) {
        const u = user as any;
        maybeGuild = u.guild;
      }
      if (maybeGuild) {
        throw new BadRequestException(
          'Bạn đã là thành viên của một công hội khác',
        );
      }
    }

    // Prevent creating duplicate pending requests for same guild
    const existingPending = await this.guildMemberRepository.findOne({
      where: { userId, guildId, isApproved: false },
    });
    if (existingPending) {
      this.logger.debug(
        `requestJoinGuild: user ${userId} already has pending request for guild ${guildId}`,
      );
      throw new BadRequestException('Bạn đã gửi yêu cầu tham gia công hội này');
    }

    const guild = await this.guildRepository.findOne({
      where: { id: guildId, status: GuildStatus.ACTIVE },
    });

    if (!guild) {
      throw new NotFoundException('Công hội không tồn tại');
    }

    if (guild.currentMembers >= guild.maxMembers) {
      throw new BadRequestException('Công hội đã đầy thành viên');
    }

    // Tạo request join as not approved yet
    const member = this.guildMemberRepository.create({
      guildId,
      userId,
      role: GuildMemberRole.MEMBER,
      isApproved: false,
    });

    const saved = await this.guildMemberRepository.save(member);
    // emit event so leaders/deputies can be notified in real-time
    this.emitJoinRequestEvent(saved);
    return saved;
  }

  // Emit join request event
  private emitJoinRequestEvent(member: GuildMember) {
    try {
      guildEvents.emit('guildJoinRequest', {
        guildId: member.guildId,
        userId: member.userId,
        username: (member as any).user?.username,
        joinedAt: member.joinedAt?.toISOString?.(),
      });
    } catch (e) {
      this.logger.warn('emitJoinRequestEvent failed', e as any);
    }
  }

  // Duyệt thành viên vào công hội
  async approveMember(
    guildId: number,
    userId: number,
    approverId: number,
  ): Promise<GuildMember> {
    // Use transaction + row locking to avoid races when approving multiple members
    if (!this.dataSource) {
      this.logger.error('approveMember: DataSource is not initialized');
      throw new InternalServerErrorException(
        'Database connection not available',
      );
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Check approver role inside the transaction
      const approver = await queryRunner.manager.findOne(GuildMember, {
        where: { guildId, userId: approverId },
      });

      if (
        !approver ||
        (approver.role !== GuildMemberRole.LEADER &&
          approver.role !== GuildMemberRole.DEPUTY)
      ) {
        throw new ForbiddenException('Bạn không có quyền duyệt thành viên');
      }

      const member = await queryRunner.manager.findOne(GuildMember, {
        where: { guildId, userId },
      });

      if (!member) {
        throw new NotFoundException('Yêu cầu tham gia không tồn tại');
      }

      if (member.isApproved) {
        throw new BadRequestException('Yêu cầu đã được duyệt trước đó');
      }

      // Lock the guild row to update currentMembers safely
      const guild = await queryRunner.manager.findOne(Guild, {
        where: { id: guildId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!guild) {
        throw new NotFoundException('Công hội không tồn tại');
      }

      if (guild.currentMembers >= guild.maxMembers) {
        throw new BadRequestException('Công hội đã đầy thành viên');
      }

      guild.currentMembers++;
      await queryRunner.manager.save(guild);

      // mark member as approved
      member.isApproved = true;
      await queryRunner.manager.save(member);

      // update user's guild_id column directly to keep users table in sync
      // Use repository metadata to get the actual table name (handles naming strategy)
      this.logger.debug('approveMember: committing transaction');
      await queryRunner.commitTransaction();
      this.logger.debug('approveMember: committed transaction');

      // Update user's guildId outside the transaction. If this fails, log but do not rollback
      // the already committed approval to avoid inconsistent UX (member approved but 500 returned).
      try {
        const userTable = this.userRepository.metadata.tableName;
        this.logger.debug(
          `approveMember: updating user table ${userTable} set guildId=${guildId} for user ${userId}`,
        );
        const updateResult = await this.userRepository.manager.query(
          `UPDATE "${userTable}" SET "guildId" = $1 WHERE id = $2 RETURNING id, "guildId"`,
          [guildId, userId],
        );
        this.logger.debug(
          `approveMember: updateResult=${JSON.stringify(updateResult)}`,
        );
      } catch (err: unknown) {
        const trace =
          err instanceof Error
            ? (err.stack ?? err.message)
            : typeof err === 'object'
              ? JSON.stringify(err)
              : String(err);
        this.logger.error(
          `approveMember: failed to update user.guildId for user=${userId} guild=${guildId}`,
          trace,
        );
        // don't throw; approval already committed
      }

      // Emit member approved event
      try {
        guildEvents.emit('guildMemberApproved', {
          guildId,
          userId,
          approvedBy: approverId,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        this.logger.warn('failed to emit guildMemberApproved', e);
      }

      return member;
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      const trace =
        err instanceof Error
          ? (err.stack ?? err.message)
          : typeof err === 'object'
            ? JSON.stringify(err)
            : String(err);
      this.logger.error(
        `approveMember failed guild=${guildId} user=${userId} approver=${approverId}`,
        trace,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Cống hiến vàng cho công hội
  async contributeGold(
    userId: number,
    guildId: number,
    amount: number,
  ): Promise<GuildMember> {
    const member = await this.guildMemberRepository.findOne({
      where: { guildId, userId },
      relations: ['guild'],
    });

    if (!member) {
      throw new NotFoundException('Bạn không phải thành viên của công hội này');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.gold < amount) {
      throw new BadRequestException('Bạn không đủ vàng');
    }

    // Trừ vàng người chơi
    user.gold -= amount;
    await this.userRepository.save(user);

    // Cộng vào quỹ công hội
    member.guild.goldFund += amount;
    await this.guildRepository.save(member.guild);

    // Cộng điểm cống hiến và điểm vinh dự
    member.contributionGold += amount;
    member.honorPoints += Math.floor(amount / 10); // 1 vàng = 0.1 điểm vinh dự
    member.weeklyContribution += amount;

    const saved = await this.guildMemberRepository.save(member);

    // Emit contribution event
    try {
      guildEvents.emit('guildContributed', {
        guildId,
        userId,
        amount,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      this.logger.warn('failed to emit guildContributed', e);
    }

    return saved;
  }

  // Lên cấp công hội
  async upgradeGuild(guildId: number, userId: number): Promise<Guild> {
    const member = await this.guildMemberRepository.findOne({
      where: { guildId, userId },
    });

    if (
      !member ||
      (member.role !== GuildMemberRole.LEADER &&
        member.role !== GuildMemberRole.DEPUTY)
    ) {
      throw new ForbiddenException('Bạn không có quyền nâng cấp công hội');
    }

    const guild = await this.guildRepository.findOne({
      where: { id: guildId },
    });
    if (!guild) {
      throw new NotFoundException('Công hội không tồn tại');
    }

    // Tính chi phí nâng cấp (tăng dần theo cấp)
    const upgradeCost = guild.level * 5000;

    if (guild.goldFund < upgradeCost) {
      throw new BadRequestException(`Cần ${upgradeCost} vàng để nâng cấp`);
    }

    // Trừ vàng và nâng cấp
    guild.goldFund -= upgradeCost;
    guild.level++;
    guild.maxMembers = 20 + (guild.level - 1) * 10; // Mỗi cấp tăng 10 slot

    return await this.guildRepository.save(guild);
  }

  // Bổ nhiệm chức vụ
  async assignRole(
    guildId: number,
    targetUserId: number,
    newRole: GuildMemberRole,
    assignerId: number,
  ): Promise<GuildMember> {
    const assigner = await this.guildMemberRepository.findOne({
      where: { guildId, userId: assignerId },
    });

    if (!assigner) {
      throw new ForbiddenException('Bạn không phải thành viên của công hội');
    }

    // Leader can assign any role. Deputy can assign roles lower than themselves (not LEADER)
    if (assigner.role === GuildMemberRole.DEPUTY) {
      if (newRole === GuildMemberRole.LEADER) {
        throw new ForbiddenException('Hội phó không thể bổ nhiệm hội trưởng');
      }
    } else if (assigner.role !== GuildMemberRole.LEADER) {
      throw new ForbiddenException('Bạn không có quyền bổ nhiệm');
    }

    const targetMember = await this.guildMemberRepository.findOne({
      where: { guildId, userId: targetUserId },
    });

    if (!targetMember) {
      throw new NotFoundException('Thành viên không tồn tại trong công hội');
    }

    // Kiểm tra giới hạn số lượng cho từng role
    if (newRole === GuildMemberRole.DEPUTY) {
      const deputyCount = await this.guildMemberRepository.count({
        where: { guildId, role: GuildMemberRole.DEPUTY },
      });
      if (deputyCount >= 2) {
        throw new BadRequestException(
          'Công hội chỉ có thể có tối đa 2 hội phó',
        );
      }
    } else if (newRole === GuildMemberRole.ELDER) {
      const elderCount = await this.guildMemberRepository.count({
        where: { guildId, role: GuildMemberRole.ELDER },
      });
      if (elderCount >= 4) {
        throw new BadRequestException(
          'Công hội chỉ có thể có tối đa 4 lãnh đạo',
        );
      }
    }

    targetMember.role = newRole;
    return await this.guildMemberRepository.save(targetMember);
  }

  // Rời công hội
  async leaveGuild(userId: number, guildId: number) {
    const member = await this.guildMemberRepository.findOne({
      where: { guildId, userId },
      relations: ['guild'],
    });

    if (!member) {
      throw new NotFoundException('Bạn không phải thành viên của công hội này');
    }

    const guild = member.guild;

    // If leader leaves, attempt to promote a deputy, else make the oldest elder, else transfer to null (disband?)
    if (member.role === GuildMemberRole.LEADER) {
      // find deputy
      const deputy = await this.guildMemberRepository.findOne({
        where: { guildId, role: GuildMemberRole.DEPUTY },
        order: { joinedAt: 'ASC' },
      });

      if (deputy) {
        deputy.role = GuildMemberRole.LEADER;
        guild.leaderId = deputy.userId;
        await this.guildMemberRepository.save(deputy);
        await this.guildRepository.save(guild);
      } else {
        // find elder
        const elder = await this.guildMemberRepository.findOne({
          where: { guildId, role: GuildMemberRole.ELDER },
          order: { joinedAt: 'ASC' },
        });
        if (elder) {
          elder.role = GuildMemberRole.LEADER;
          guild.leaderId = elder.userId;
          await this.guildMemberRepository.save(elder);
          await this.guildRepository.save(guild);
        } else {
          // No one to promote: mark guild as disbanded
          guild.status = GuildStatus.DISBANDED;
          await this.guildRepository.save(guild);
        }
      }
    }

    // Remove the member (use delete by id to ensure SQL DELETE)
    try {
      await this.guildMemberRepository.delete({ id: member.id });
    } catch (err: unknown) {
      const trace =
        err instanceof Error
          ? (err.stack ?? err.message)
          : typeof err === 'object'
            ? JSON.stringify(err)
            : String(err);
      this.logger.error(
        `leaveGuild: failed to delete guild_member id=${member.id}`,
        trace,
      );
      throw err;
    }

    // clear user's guildId reference using repository metadata for table name
    try {
      const userTable = this.userRepository.metadata.tableName;
      this.logger.debug(
        `leaveGuild: clearing guildId on ${userTable} for user ${userId}`,
      );
      await this.userRepository.manager.query(
        `UPDATE "${userTable}" SET "guildId" = NULL WHERE id = $1`,
        [userId],
      );
    } catch (err: unknown) {
      const trace =
        err instanceof Error
          ? (err.stack ?? err.message)
          : typeof err === 'object'
            ? JSON.stringify(err)
            : String(err);
      this.logger.error(
        `leaveGuild: failed to clear user.guildId for user=${userId}`,
        trace,
      );
      throw err;
    }
    // Decrement currentMembers if guild still active
    if (guild.status === GuildStatus.ACTIVE && guild.currentMembers > 0) {
      guild.currentMembers = Math.max(0, guild.currentMembers - 1);
      await this.guildRepository.save(guild);
    }

    return { success: true };
  }

  // Tạo sự kiện công hội chiến
  async createGuildWar(
    guildId: number,
    opponentGuildId: number,
    scheduledAt: Date,
  ): Promise<GuildEvent> {
    const guild = await this.guildRepository.findOne({
      where: { id: guildId },
    });
    if (!guild || guild.level < 2) {
      throw new BadRequestException(
        'Công hội phải đạt cấp 2 trở lên mới có thể tham gia công hội chiến',
      );
    }

    const event = this.guildEventRepository.create({
      guildId,
      eventType: GuildEventType.GUILD_WAR,
      title: 'Công hội chiến',
      description: `Chiến đấu với công hội đối thủ`,
      opponentGuildId,
      scheduledAt,
      status: GuildEventStatus.PENDING,
    });

    return await this.guildEventRepository.save(event);
  }

  // Lấy danh sách công hội
  async getGuilds(): Promise<Guild[]> {
    // Sweep: mark any ACTIVE guilds that have no members as DISBANDED so they
    // do not appear in public listings. Use a single UPDATE query for efficiency.
    try {
      await this.guildRepository.manager.query(
        `UPDATE "${this.guildRepository.metadata.tableName}" SET status = $1 WHERE status = $2 AND "currentMembers" <= 0`,
        [GuildStatus.DISBANDED, GuildStatus.ACTIVE],
      );
    } catch (e) {
      this.logger.warn(
        'getGuilds: failed to auto-disband empty guilds',
        e as any,
      );
    }

    return await this.guildRepository.find({
      where: { status: GuildStatus.ACTIVE },
      relations: ['leader'],
      order: { level: 'DESC', createdAt: 'DESC' },
    });
  }

  // Lấy chi tiết công hội
  async getGuild(guildId: number): Promise<Guild> {
    const guild = await this.guildRepository.findOne({
      where: { id: guildId },
      relations: ['leader', 'members', 'members.user'],
    });

    if (!guild) {
      throw new NotFoundException('Công hội không tồn tại');
    }

    return guild;
  }

  // Lấy công hội của người chơi
  async getUserGuild(userId: number): Promise<Guild | null> {
    const member = await this.guildMemberRepository.findOne({
      where: { userId, isApproved: true },
      relations: ['guild'],
    });

    return member ? member.guild : null;
  }

  // Lấy thành viên công hội
  async getGuildMembers(guildId: number): Promise<GuildMember[]> {
    // return only approved members
    return await this.guildMemberRepository.find({
      where: { guildId, isApproved: true },
      relations: ['user'],
      order: { role: 'ASC', joinedAt: 'ASC' },
    });
  }

  // Lấy các yêu cầu tham gia (chưa duyệt)
  async getGuildRequests(guildId: number): Promise<GuildMember[]> {
    return await this.guildMemberRepository.find({
      where: { guildId, isApproved: false },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
  }

  // Từ chối (xóa) yêu cầu tham gia
  async rejectMember(guildId: number, userId: number, rejecterId: number) {
    // Only leader or deputy can reject
    const rejecter = await this.guildMemberRepository.findOne({
      where: { guildId, userId: rejecterId },
    });
    if (
      !rejecter ||
      (rejecter.role !== GuildMemberRole.LEADER &&
        rejecter.role !== GuildMemberRole.DEPUTY)
    ) {
      throw new ForbiddenException('Bạn không có quyền từ chối yêu cầu');
    }

    const member = await this.guildMemberRepository.findOne({
      where: { guildId, userId, isApproved: false },
    });
    if (!member) {
      throw new NotFoundException('Yêu cầu không tồn tại');
    }

    await this.guildMemberRepository.remove(member);
    // Emit reject event
    try {
      guildEvents.emit('guildJoinRequestRejected', {
        guildId,
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      this.logger.warn('failed to emit guildJoinRequestRejected', e);
    }
    return { success: true };
  }

  // Đuổi thành viên
  async kickMember(guildId: number, targetUserId: number, kickerId: number) {
    // Only leader or deputy can kick
    const kicker = await this.guildMemberRepository.findOne({
      where: { guildId, userId: kickerId },
    });
    if (
      !kicker ||
      (kicker.role !== GuildMemberRole.LEADER &&
        kicker.role !== GuildMemberRole.DEPUTY)
    ) {
      throw new ForbiddenException('Bạn không có quyền đuổi thành viên');
    }

    // Can't kick the leader
    const targetMember = await this.guildMemberRepository.findOne({
      where: { guildId, userId: targetUserId, isApproved: true },
      relations: ['guild'],
    });
    if (!targetMember) {
      throw new NotFoundException('Thành viên không tồn tại trong công hội');
    }

    if (targetMember.role === GuildMemberRole.LEADER) {
      throw new BadRequestException('Không thể đuổi hội trưởng');
    }

    const guild = targetMember.guild;

    // Delete the member row
    try {
      await this.guildMemberRepository.delete({ id: targetMember.id });
    } catch (err: unknown) {
      const trace =
        err instanceof Error
          ? (err.stack ?? err.message)
          : typeof err === 'object'
            ? JSON.stringify(err)
            : String(err);
      this.logger.error(
        `kickMember: failed to delete member id=${targetMember.id}`,
        trace,
      );
      throw err;
    }

    // Clear user's guildId
    try {
      const userTable = this.userRepository.metadata.tableName;
      this.logger.debug(
        `kickMember: clearing guildId on ${userTable} for user ${targetUserId}`,
      );
      await this.userRepository.manager.query(
        `UPDATE "${userTable}" SET "guildId" = NULL WHERE id = $1`,
        [targetUserId],
      );
    } catch (err: unknown) {
      const trace =
        err instanceof Error
          ? (err.stack ?? err.message)
          : typeof err === 'object'
            ? JSON.stringify(err)
            : String(err);
      this.logger.error(
        `kickMember: failed to clear user.guildId for user=${targetUserId}`,
        trace,
      );
      // don't throw; member removed already
    }

    // Decrement currentMembers if guild active
    if (
      guild &&
      guild.status === GuildStatus.ACTIVE &&
      guild.currentMembers > 0
    ) {
      guild.currentMembers = Math.max(0, guild.currentMembers - 1);
      await this.guildRepository.save(guild);
    }

    return { success: true };
  }

  // Lấy sự kiện công hội
  async getGuildEvents(guildId: number): Promise<GuildEvent[]> {
    return await this.guildEventRepository.find({
      where: { guildId },
      order: { createdAt: 'DESC' },
    });
  }

  // Dev helper: attempt to clean stale membership for a user and return diagnostics
  // NOTE: only intended to be called from dev-only endpoints
  async _dev_cleanStaleMembership(userId: number) {
    const diag: any = {
      userId,
      foundMember: null,
      memberGuild: null,
      deletedMember: false,
      clearedUserGuildId: false,
      errors: [],
    };
    if (!this.dataSource) {
      this.logger.error(
        '_dev_cleanStaleMembership: DataSource is not initialized',
      );
      throw new InternalServerErrorException(
        'Database connection not available',
      );
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const existingMember = await queryRunner.manager.findOne(GuildMember, {
        where: { userId },
      });
      diag.foundMember = existingMember || null;
      if (!existingMember) {
        await queryRunner.commitTransaction();
        return diag;
      }

      const memberGuild = await queryRunner.manager.findOne(Guild, {
        where: { id: existingMember.guildId },
      });
      diag.memberGuild = memberGuild || null;

      if (!memberGuild || memberGuild.status === GuildStatus.DISBANDED) {
        try {
          await queryRunner.manager.delete(GuildMember, {
            id: existingMember.id,
          });
          diag.deletedMember = true;
        } catch (delErr) {
          diag.errors.push({ step: 'deleteMember', error: String(delErr) });
        }

        try {
          const userTable = this.userRepository.metadata.tableName;
          await queryRunner.manager.query(
            `UPDATE "${userTable}" SET "guildId" = NULL WHERE id = $1`,
            [userId],
          );
          diag.clearedUserGuildId = true;
        } catch (updateErr) {
          diag.errors.push({
            step: 'clearUserGuildId',
            error: String(updateErr),
          });
        }
      }

      await queryRunner.commitTransaction();
      return diag;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      diag.errors.push({ step: 'transaction', error: String(err) });
      return diag;
    } finally {
      await queryRunner.release();
    }
  }

  // Admin: Reset guild level
  async resetGuildLevel(
    guildId: number,
    newLevel: number,
    newExperience: number = 0,
  ): Promise<Guild> {
    const guild = await this.guildRepository.findOne({
      where: { id: guildId },
      relations: ['members', 'members.user'],
    });

    if (!guild) {
      throw new NotFoundException('Guild not found');
    }

    if (newLevel < 1 || newLevel > 20) {
      throw new BadRequestException('Guild level must be between 1 and 20');
    }

    // Update guild level and experience
    guild.level = newLevel;
    guild.experience = newExperience;

    const updatedGuild = await this.guildRepository.save(guild);

    // Log the admin action
    this.logger.log(
      `Admin reset guild ${guild.name} (ID: ${guildId}) to level ${newLevel} with ${newExperience} experience`,
    );

    return updatedGuild;
  }

  // Admin: Get all guilds
  async getAllGuilds(): Promise<Guild[]> {
    return this.guildRepository.find({
      relations: ['members', 'members.user'],
      order: { level: 'DESC', experience: 'DESC' },
    });
  }
}
