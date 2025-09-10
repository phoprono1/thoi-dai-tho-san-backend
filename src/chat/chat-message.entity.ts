import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum ChatType {
  WORLD = 'world',
  GUILD = 'guild',
}

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  @Index()
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: ChatType,
    default: ChatType.WORLD,
  })
  @Index()
  type: ChatType;

  @Column({ type: 'integer', nullable: true })
  @Index()
  guildId: number;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;
}
