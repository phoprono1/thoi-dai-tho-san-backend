import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ScratchCardType } from './scratch-card-type.entity';

export enum PrizeType {
  GOLD = 'gold',
  ITEM = 'item',
  TITLE = 'title',
  CONSUMABLE = 'consumable',
}

@Entity('scratch_card_type_prizes')
export class ScratchCardTypePrize {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ScratchCardType, (type) => type.prizes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'card_type_id' })
  cardType: ScratchCardType;

  @Column({ name: 'prize_type', type: 'enum', enum: PrizeType })
  prizeType: PrizeType;

  @Column({ name: 'prize_value' })
  prizeValue: number; // Gold amount, item ID, title ID, or consumable ID

  @Column({ name: 'prize_quantity', default: 1 })
  prizeQuantity: number;

  @Column({
    name: 'probability_weight',
    default: 1,
    comment: 'Higher weight = higher chance',
  })
  probabilityWeight: number;

  @Column({
    name: 'tax_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: '0.10',
    comment: 'Tax rate as decimal (0.10 = 10%)',
  })
  taxRate: number;

  @Column({
    name: 'max_claims',
    nullable: true,
    comment: 'Maximum times this prize can be claimed, null = unlimited',
  })
  maxClaims: number;

  @Column({ name: 'claims_count', default: 0 })
  claimsCount: number;
}
