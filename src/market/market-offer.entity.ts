import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('market_offer')
export class MarketOffer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  listingId: number;

  @Column({ type: 'integer' })
  buyerId: number;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'boolean', default: false })
  accepted: boolean;

  @Column({ type: 'boolean', default: false })
  cancelled: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
