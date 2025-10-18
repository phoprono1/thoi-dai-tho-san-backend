import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ScratchCardTypePrize } from './scratch-card-type-prize.entity';
import { UserScratchCard } from './user-scratch-card.entity';

@Entity('scratch_card_types')
export class ScratchCardType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;
  @Column({ name: 'background_image_url', length: 500, nullable: true })
  backgroundImageUrl: string;

  @Column({ name: 'cost_gold', default: 100 })
  costGold: number;

  @Column({ name: 'grid_rows', default: 3 })
  gridRows: number;

  @Column({ name: 'grid_cols', default: 3 })
  gridCols: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => ScratchCardTypePrize, (prize) => prize.cardType)
  prizes: ScratchCardTypePrize[];

  @OneToMany(() => UserScratchCard, (card) => card.cardType)
  userCards: UserScratchCard[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
