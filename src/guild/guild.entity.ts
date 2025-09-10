import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum GuildMemberRole {
  LEADER = 'LEADER', // Hội trưởng
  DEPUTY = 'DEPUTY', // Hội phó
  ELDER = 'ELDER', // Lãnh đạo (4 người)
  MEMBER = 'MEMBER', // Thành viên
}

export enum GuildStatus {
  ACTIVE = 'ACTIVE',
  DISBANDED = 'DISBANDED',
}

@Entity('guilds')
export class Guild {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ type: 'int', default: 0 })
  experience: number;

  @Column({ type: 'int', default: 0 })
  goldFund: number; // Quỹ vàng chung

  @Column({ type: 'int', default: 0 })
  maxMembers: number;

  @Column({ type: 'int', default: 0 })
  currentMembers: number;

  @Column({
    type: 'enum',
    enum: GuildStatus,
    default: GuildStatus.ACTIVE,
  })
  status: GuildStatus;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'leaderId' })
  leader: User;

  @Column()
  leaderId: number;

  @Column({ nullable: true })
  announcement: string; // Thông báo công hội

  @Column({ type: 'json', nullable: true })
  settings: any; // Cài đặt công hội

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => GuildMember, (member) => member.guild, { cascade: true })
  members: GuildMember[];

  @OneToMany(() => GuildEvent, (event) => event.guild, { cascade: true })
  events: GuildEvent[];
}

@Entity('guild_members')
export class GuildMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Guild, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guildId' })
  guild: Guild;

  @Column()
  guildId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({
    type: 'enum',
    enum: GuildMemberRole,
    default: GuildMemberRole.MEMBER,
  })
  role: GuildMemberRole;

  @Column({ type: 'int', default: 0 })
  contributionGold: number; // Vàng đã cống hiến

  @Column({ type: 'int', default: 0 })
  honorPoints: number; // Điểm vinh dự

  @Column({ type: 'int', default: 0 })
  weeklyContribution: number; // Cống hiến tuần này

  @Column({ type: 'boolean', default: false })
  isOnline: boolean;

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ nullable: true })
  lastActiveAt: Date;
}

export enum GuildEventType {
  GUILD_WAR = 'GUILD_WAR', // Công hội chiến
  GUILD_MISSION = 'GUILD_MISSION', // Nhiệm vụ công hội
  GUILD_UPGRADE = 'GUILD_UPGRADE', // Lên cấp công hội
}

export enum GuildEventStatus {
  PENDING = 'PENDING', // Chờ
  IN_PROGRESS = 'IN_PROGRESS', // Đang diễn ra
  COMPLETED = 'COMPLETED', // Hoàn thành
  CANCELLED = 'CANCELLED', // Hủy
}

@Entity('guild_events')
export class GuildEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Guild, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guildId' })
  guild: Guild;

  @Column()
  guildId: number;

  @Column({
    type: 'enum',
    enum: GuildEventType,
  })
  eventType: GuildEventType;

  @Column({
    type: 'enum',
    enum: GuildEventStatus,
    default: GuildEventStatus.PENDING,
  })
  status: GuildEventStatus;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  participants: any; // Danh sách người tham gia

  @Column({ type: 'json', nullable: true })
  eventData: any; // Dữ liệu sự kiện (kết quả, điểm số, v.v.)

  @Column({ nullable: true })
  opponentGuildId: number; // ID công hội đối thủ (cho guild war)

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date; // Thời gian diễn ra

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date; // Thời gian hoàn thành

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
