import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('shop_item')
export class ShopItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  itemId: number;

  @Column({ type: 'integer' })
  price: number; // price in gold

  @Column({ type: 'integer', default: 1 })
  quantity: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
