import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ItemType, ConsumableType } from './item-types.enum';
import { ItemSet } from './item-set.entity';
import {
  ClassType,
  ClassTier,
} from '../character-classes/character-class.entity';

@Entity()
export class Item {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: ItemType,
    default: ItemType.MATERIAL,
  })
  type: ItemType;

  @Column({
    type: 'enum',
    enum: ConsumableType,
    nullable: true,
  })
  consumableType: ConsumableType;

  @Column({ default: 1 })
  rarity: number; // 1-5 (common to legendary)

  @Column({ type: 'int', nullable: true })
  price: number;

  @Column('json', { nullable: true })
  stats: {
    // Base stats
    attack?: number;
    defense?: number;
    hp?: number;
    mp?: number;
    experience?: number;
    // Advanced stats
    critRate?: number; // Bạo kích (%)
    critDamage?: number; // Sát thương bạo kích (%)
    comboRate?: number; // Liên kích (%)
    counterRate?: number; // Phản kích (%)
    lifesteal?: number; // Hút máu (%)
    armorPen?: number; // Xuyên giáp (%)
    dodgeRate?: number; // Né tránh (%)
    accuracy?: number; // Chính xác (%)
    // Stat boosts for consumables
    strength?: number;
    intelligence?: number;
    dexterity?: number;
    vitality?: number;
    luck?: number;
  };

  @Column('json', { nullable: true })
  classRestrictions: {
    allowedClassTypes?: ClassType[]; // Class types that can use this item
    restrictedClassTypes?: ClassType[]; // Class types that cannot use this item
    requiredLevel?: number; // Minimum level required
    requiredTier?: ClassTier; // Minimum tier required
    description?: string; // Description of restrictions
  };

  @Column({ type: 'int', nullable: true })
  setId: number; // Reference to ItemSet

  @ManyToOne(() => ItemSet, { nullable: true })
  @JoinColumn({ name: 'setId' })
  itemSet: ItemSet;

  @Column({ type: 'int', nullable: true })
  consumableValue: number;

  @Column({ type: 'int', nullable: true })
  duration: number; // For stat boost duration in minutes

  @Column({ type: 'text', nullable: true })
  image?: string; // relative path or URL to item image (e.g. /assets/items/1.png)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
