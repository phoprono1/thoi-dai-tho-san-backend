import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
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

@Injectable()
export class GuildService {
  constructor(
    @InjectRepository(Guild)
    private guildRepository: Repository<Guild>,
    @InjectRepository(GuildMember)
    private guildMemberRepository: Repository<GuildMember>,
    @InjectRepository(GuildEvent)
    private guildEventRepository: Repository<GuildEvent>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // Tạo công hội mới
  async createGuild(
    userId: number,
    name: string,
    description?: string,
  ): Promise<Guild> {
    // Kiểm tra người dùng đã có công hội chưa
    const existingMember = await this.guildMemberRepository.findOne({
      where: { userId },
    });

    if (existingMember) {
      throw new BadRequestException(
        'Bạn đã là thành viên của một công hội khác',
      );
    }

    // Kiểm tra tên công hội có bị trùng không
    const existingGuild = await this.guildRepository.findOne({
      where: { name },
    });

    if (existingGuild) {
      throw new BadRequestException('Tên công hội đã tồn tại');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const guild = this.guildRepository.create({
      name,
      description,
      leaderId: userId,
      maxMembers: 20, // Lv1: 20 thành viên
      currentMembers: 1,
    });

    const savedGuild = await this.guildRepository.save(guild);

    // Tự động thêm hội trưởng vào công hội
    const leaderMember = this.guildMemberRepository.create({
      guildId: savedGuild.id,
      userId,
      role: GuildMemberRole.LEADER,
    });

    await this.guildMemberRepository.save(leaderMember);

    return savedGuild;
  }

  // Xin vào công hội
  async requestJoinGuild(
    userId: number,
    guildId: number,
  ): Promise<GuildMember> {
    // Kiểm tra người dùng đã có công hội chưa
    const existingMember = await this.guildMemberRepository.findOne({
      where: { userId },
    });

    if (existingMember) {
      throw new BadRequestException(
        'Bạn đã là thành viên của một công hội khác',
      );
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

    // Tạo request join (có thể thêm status PENDING sau)
    const member = this.guildMemberRepository.create({
      guildId,
      userId,
      role: GuildMemberRole.MEMBER,
    });

    return await this.guildMemberRepository.save(member);
  }

  // Duyệt thành viên vào công hội
  async approveMember(
    guildId: number,
    userId: number,
    approverId: number,
  ): Promise<GuildMember> {
    // Kiểm tra quyền duyệt
    const approver = await this.guildMemberRepository.findOne({
      where: { guildId, userId: approverId },
    });

    if (
      !approver ||
      (approver.role !== GuildMemberRole.LEADER &&
        approver.role !== GuildMemberRole.DEPUTY)
    ) {
      throw new ForbiddenException('Bạn không có quyền duyệt thành viên');
    }

    const member = await this.guildMemberRepository.findOne({
      where: { guildId, userId },
    });

    if (!member) {
      throw new NotFoundException('Yêu cầu tham gia không tồn tại');
    }

    // Cập nhật số lượng thành viên
    const guild = await this.guildRepository.findOne({
      where: { id: guildId },
    });
    if (!guild) {
      throw new NotFoundException('Công hội không tồn tại');
    }
    guild.currentMembers++;
    await this.guildRepository.save(guild);

    return member;
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

    return await this.guildMemberRepository.save(member);
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
    const upgradeCost = guild.level * 1000;

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

    if (!assigner || assigner.role !== GuildMemberRole.LEADER) {
      throw new ForbiddenException('Chỉ hội trưởng mới có quyền bổ nhiệm');
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
      where: { userId },
      relations: ['guild'],
    });

    return member ? member.guild : null;
  }

  // Lấy thành viên công hội
  async getGuildMembers(guildId: number): Promise<GuildMember[]> {
    return await this.guildMemberRepository.find({
      where: { guildId },
      relations: ['user'],
      order: { role: 'ASC', joinedAt: 'ASC' },
    });
  }

  // Lấy sự kiện công hội
  async getGuildEvents(guildId: number): Promise<GuildEvent[]> {
    return await this.guildEventRepository.find({
      where: { guildId },
      order: { createdAt: 'DESC' },
    });
  }
}
