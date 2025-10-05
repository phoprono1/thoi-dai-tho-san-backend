import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type FeedingItemType = 'food' | 'treat' | 'medicine' | 'toy';

export interface FeedingEffect {
  type: string; // 'exp', 'friendship', 'health', 'energy', 'happiness'
  value: number;
  isPercentage: boolean;
}

export interface UsageRequirement {
  condition: string; // 'low_health', 'low_energy', 'min_level', etc.
  value?: number | string;
}

@Entity('pet_feeding_items')
@Index(['itemType', 'rarity'])
export class PetFeedingItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: ['food', 'treat', 'medicine', 'toy'],
  })
  itemType: FeedingItemType;

  @Column({ type: 'int' })
  rarity: number; // 1-5

  @Column({ type: 'jsonb' })
  effects: FeedingEffect[];

  @Column({ type: 'jsonb', default: [] })
  requirements: UsageRequirement[];

  @Column({ default: 1 })
  stackSize: number; // How many can stack in inventory

  @Column({ default: 1 })
  usageLimit: number; // Uses per day/session

  @Column({ default: 1 })
  cooldownHours: number; // Hours between uses

  @Column({ nullable: true })
  petTypeBonus: string | null; // Extra effect for specific pet type

  @Column({ default: 0 })
  bonusMultiplier: number; // Multiplier for pet type bonus

  @Column({ type: 'text', nullable: true })
  iconImage: string | null;

  @Column({ default: true })
  isObtainable: boolean;

  @Column({ default: 0 })
  marketValue: number; // Base sell/buy price

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  canUseOnPet(
    petType: string,
    petLevel: number,
    petHealth: number,
    petEnergy: number,
  ): boolean {
    for (const req of this.requirements) {
      switch (req.condition) {
        case 'min_level':
          if (petLevel < (Number(req.value) || 1)) return false;
          break;
        case 'low_health':
          if (petHealth >= (Number(req.value) || 50)) return false;
          break;
        case 'low_energy':
          if (petEnergy >= (Number(req.value) || 50)) return false;
          break;
        case 'pet_type':
          if (petType !== String(req.value)) return false;
          break;
      }
    }
    return true;
  }

  getEffectValue(effectType: string, petType?: string): number {
    const effect = this.effects.find((e) => e.type === effectType);
    if (!effect) return 0;

    let value = effect.value;

    // Apply pet type bonus
    if (petType && this.petTypeBonus === petType && this.bonusMultiplier > 0) {
      value *= 1 + this.bonusMultiplier;
    }

    return value;
  }

  getExpGain(petType?: string): number {
    return this.getEffectValue('exp', petType);
  }

  getFriendshipGain(petType?: string): number {
    return this.getEffectValue('friendship', petType);
  }

  getHealthRestore(petType?: string): number {
    return this.getEffectValue('health', petType);
  }

  getEnergyRestore(petType?: string): number {
    return this.getEffectValue('energy', petType);
  }

  getHappinessGain(petType?: string): number {
    return this.getEffectValue('happiness', petType);
  }

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

  getTypeIcon(): string {
    const typeIcons = {
      food: '🍖',
      treat: '🍯',
      medicine: '💊',
      toy: '🎾',
    };
    return typeIcons[this.itemType] || '📦';
  }

  getFormattedEffects(): string[] {
    return this.effects.map((effect) => {
      const sign = effect.value > 0 ? '+' : '';
      const suffix = effect.isPercentage ? '%' : '';
      return `${effect.type.toUpperCase()}: ${sign}${effect.value}${suffix}`;
    });
  }

  getFormattedValue(): string {
    if (this.marketValue >= 1000) {
      return `${(this.marketValue / 1000).toFixed(1)}K`;
    }
    return this.marketValue.toString();
  }

  hasTypeBonus(petType: string): boolean {
    return this.petTypeBonus === petType && this.bonusMultiplier > 0;
  }

  getBonusDescription(petType: string): string {
    if (!this.hasTypeBonus(petType)) return '';
    const multiplier = Math.round(this.bonusMultiplier * 100);
    return `+${multiplier}% effect for ${petType} pets`;
  }

  getUsageLimitText(): string {
    if (this.usageLimit === 1) return 'Once per day';
    return `${this.usageLimit} times per day`;
  }

  getCooldownText(): string {
    if (this.cooldownHours < 1) return 'No cooldown';
    if (this.cooldownHours === 1) return '1 hour cooldown';
    if (this.cooldownHours >= 24) {
      const days = Math.floor(this.cooldownHours / 24);
      return days === 1 ? '1 day cooldown' : `${days} days cooldown`;
    }
    return `${this.cooldownHours} hours cooldown`;
  }

  getFeedingItemSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.itemType,
      typeIcon: this.getTypeIcon(),
      rarity: this.rarity,
      rarityEmoji: this.getRarityEmoji(),
      effects: this.getFormattedEffects(),
      marketValue: this.getFormattedValue(),
      stackSize: this.stackSize,
      usageLimit: this.getUsageLimitText(),
      cooldown: this.getCooldownText(),
    };
  }
}
