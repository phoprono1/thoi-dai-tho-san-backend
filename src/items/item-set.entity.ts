import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Item } from './item.entity';

export enum SetBonusType {
  FLAT = 'flat', // Fixed value bonus
  PERCENTAGE = 'percentage', // Percentage bonus
}

@Entity('item_sets')
export class ItemSet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 1 })
  rarity: number; // 1-5 (common to legendary)

  @Column('json')
  setBonuses: {
    pieces: number; // Number of pieces required for this bonus
    type: SetBonusType;
    stats: {
      attack?: number;
      defense?: number;
      hp?: number;
      mp?: number;
      critRate?: number;
      critDamage?: number;
      comboRate?: number;
      counterRate?: number;
      lifesteal?: number;
      armorPen?: number;
      dodgeRate?: number;
      accuracy?: number;
      strength?: number;
      intelligence?: number;
      dexterity?: number;
      vitality?: number;
      luck?: number;
    };
    description: string; // Human readable description
  }[];

  // An Item belongs to a single ItemSet via Item.setId / Item.itemSet
  // Use OneToMany here to match the ManyToOne on the Item side.
  @OneToMany(() => Item, (item) => item.itemSet)
  items: Item[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
