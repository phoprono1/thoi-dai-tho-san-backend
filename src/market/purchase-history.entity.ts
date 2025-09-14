import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('purchase_history')
export class PurchaseHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  buyerId: number;

  @Column({ type: 'integer' })
  sellerId: number;

  @Column({ type: 'integer' })
  itemId: number;

  @Column({ type: 'integer' })
  price: number;

  @CreateDateColumn()
  createdAt: Date;
}
