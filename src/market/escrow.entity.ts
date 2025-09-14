import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('escrow')
export class Escrow {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  offerId: number;

  @Column({ type: 'integer' })
  buyerId: number;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'boolean', default: false })
  released: boolean; // captured by seller

  @Column({ type: 'boolean', default: false })
  refunded: boolean; // returned to buyer via mailbox

  @CreateDateColumn()
  createdAt: Date;
}
