import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type EquipmentSlot = 'collar' | 'armor' | 'accessory' | 'weapon';
export type EquipmentRarity = 1 | 2 | 3 | 4 | 5;

export interface StatBoost {
  stat: string; // 'hp', 'attack', 'defense', 'speed', 'mana'
  value: number;
  isPercentage: boolean; // true for %, false for flat
}

export interface SpecialEffect {
  name: string;
  description: string;
  value: number;
  condition?: string; // When effect triggers
}

@Entity('pet_equipment')
@Index(['slot', 'rarity'])
export class PetEquipment {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: ['collar', 'armor', 'accessory', 'weapon'],
  })
  slot: EquipmentSlot;

  @Column({ type: 'int', default: 1 })
  rarity: EquipmentRarity;

  @Column({ type: 'jsonb', name: 'statBonuses' })
  statBoosts: StatBoost[];

  @Column({ type: 'jsonb', nullable: true })
  setBonus: Record<string, any> | null;

  @Column({ type: 'jsonb', default: [] })
  compatibleElements: string[];

  @Column({ type: 'text', nullable: true })
  image: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  getRarityColor(): string {
    const colors = {
      1: '#FFFFFF', // White
      2: '#00FF00', // Green
      3: '#0000FF', // Blue
      4: '#800080', // Purple
      5: '#FFD700', // Gold
    };
    return colors[this.rarity] || colors[1];
  }

  getRarityEmoji(): string {
    const emojis = {
      1: '⚪',
      2: '🟢',
      3: '🔵',
      4: '🟣',
      5: '🟡',
    };
    return emojis[this.rarity] || emojis[1];
  }

  getSlotIcon(): string {
    const slotIcons = {
      collar: '🎀',
      armor: '🛡️',
      accessory: '💍',
      weapon: '⚔️',
    };
    return slotIcons[this.slot] || '📦';
  }

  getTotalStatBoost(stat: string): number {
    return this.statBoosts
      .filter((boost) => boost.stat === stat)
      .reduce((total, boost) => total + boost.value, 0);
  }

  getPercentageStatBoost(stat: string): number {
    return this.statBoosts
      .filter((boost) => boost.stat === stat && boost.isPercentage)
      .reduce((total, boost) => total + boost.value, 0);
  }

  getFlatStatBoost(stat: string): number {
    return this.statBoosts
      .filter((boost) => boost.stat === stat && !boost.isPercentage)
      .reduce((total, boost) => total + boost.value, 0);
  }

  getFormattedStatBoosts(): string[] {
    return this.statBoosts.map((boost) => {
      const sign = boost.value > 0 ? '+' : '';
      const suffix = boost.isPercentage ? '%' : '';
      return `${boost.stat.toUpperCase()}: ${sign}${boost.value}${suffix}`;
    });
  }

  getEquipmentSummary() {
    return {
      id: this.id,
      name: this.name,
      slot: this.slot,
      slotIcon: this.getSlotIcon(),
      rarity: this.rarity,
      rarityEmoji: this.getRarityEmoji(),
      statBoosts: this.getFormattedStatBoosts(),
    };
  }
}
