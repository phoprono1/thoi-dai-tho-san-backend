import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Item } from '../items/item.entity';
import { GachaBox } from './gacha-box.entity';

@Entity()
export class UserGachaBox {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => Item, { nullable: true })
  @JoinColumn()
  item: Item;

  @Column({ type: 'int', nullable: true })
  itemId: number;

  @ManyToOne(() => GachaBox)
  @JoinColumn()
  box: GachaBox;

  @Column({ type: 'int' })
  boxId: number;

  @Column({ type: 'text', nullable: true })
  seed?: string;

  @Column('json', { nullable: true })
  metadata?: any;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ default: false })
  consumed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  consumedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
