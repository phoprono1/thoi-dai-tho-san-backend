import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('market_listing')
export class MarketListing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  sellerId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column({ type: 'integer' })
  itemId: number;

  @Column({ type: 'integer', default: 1 })
  quantity: number;

  @Column({ type: 'integer' })
  price: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
