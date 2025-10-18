import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { ScratchCardType } from './scratch-card-type.entity';

export interface ScratchedPrize {
  prizeId?: number | null;
  prizeType: string;
  prizeValue?: number;
  prizeQuantity?: number;
  taxDeducted?: number;
  finalAmount?: number;
  positionRow: number;
  positionCol: number;
  // optional: reveal player's number or message for empty cells
  playerNumber?: number;
  message?: string;
}

export interface PlacedPrize {
  prizeId: number;
  positionRow: number;
  positionCol: number;
}

@Entity('user_scratch_cards')
export class UserScratchCard {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => ScratchCardType, (type) => type.userCards, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'card_type_id' })
  cardType: ScratchCardType;

  @Column({ comment: 'The lucky number assigned to player (1-100)' })
  @Column({
    name: 'player_number',
    comment: 'The lucky number assigned to player (1-100)',
  })
  playerNumber: number;

  @Column({
    name: 'scratched_positions',
    type: 'json',
    default: [],
    comment: 'Array of scratched position indices',
  })
  scratchedPositions: number[];

  @Column({
    name: 'revealed_prizes',
    type: 'json',
    default: [],
    comment: 'Array of revealed prize objects',
  })
  revealedPrizes: ScratchedPrize[];

  @Column({
    name: 'position_numbers',
    type: 'json',
    default: [],
    comment: 'Array of numbers assigned to each position (1-9 for 3x3 grid)',
  })
  positionNumbers: number[];

  @Column({
    name: 'placed_prizes',
    type: 'json',
    default: [],
    comment: 'Array of prizes placed on this user card with positions',
  })
  placedPrizes: PlacedPrize[];

  @Column({ name: 'is_completed', default: false })
  isCompleted: boolean;

  @Column({ name: 'total_gold_won', default: 0 })
  totalGoldWon: number;

  @Column({
    name: 'total_items_won',
    type: 'json',
    default: [],
    comment: 'Array of won items with quantities',
  })
  totalItemsWon: Array<{ itemId: number; quantity: number }>;

  @Column({
    name: 'tax_deducted',
    default: 0,
    comment: 'Total gold deducted as tax',
  })
  taxDeducted: number;

  @Column({
    name: 'final_gold_received',
    default: 0,
    comment: 'Gold after tax deduction',
  })
  finalGoldReceived: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;
}
