import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Dungeon } from '../dungeons/dungeon.entity';

export enum RoomStatus {
  WAITING = 'waiting',
  STARTING = 'starting',
  IN_COMBAT = 'in_combat',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PlayerStatus {
  INVITED = 'invited',
  JOINED = 'joined',
  READY = 'ready',
  LEFT = 'left',
}

@Entity()
export class RoomLobby {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  host: User;

  @Column()
  hostId: number;

  @ManyToOne(() => Dungeon, { onDelete: 'CASCADE' })
  @JoinColumn()
  dungeon: Dungeon;

  @Column()
  dungeonId: number;

  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.WAITING,
  })
  status: RoomStatus;

  @Column({ default: 1 })
  minPlayers: number;

  @Column({ default: 4 })
  maxPlayers: number;

  @Column({ default: false })
  isPrivate: boolean;

  @Column({ nullable: true })
  password: string;

  @OneToMany(() => RoomPlayer, (roomPlayer) => roomPlayer.room, {
    cascade: true,
  })
  players: RoomPlayer[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity()
export class RoomPlayer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => RoomLobby, { onDelete: 'CASCADE' })
  @JoinColumn()
  room: RoomLobby;

  @Column()
  roomId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  player: User;

  @Column()
  playerId: number;

  @Column({
    type: 'enum',
    enum: PlayerStatus,
    default: PlayerStatus.JOINED,
  })
  status: PlayerStatus;

  @Column({ default: false })
  isReady: boolean;

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ nullable: true })
  leftAt: Date;

  // Timestamp of the player's last observed activity in this room (socket message,
  // REST action). Used by server-side cleanup to detect stale/abandoned players.
  @Column({ type: 'timestamp', nullable: true })
  lastSeen: Date;
}
