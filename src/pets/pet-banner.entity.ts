import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PetGachaPull } from './pet-gacha-pull.entity';
import { UserPetBannerPity } from './user-pet-banner-pity.entity';

export type BannerType = 'standard' | 'featured' | 'limited' | 'event';

export interface FeaturedPet {
  petId: string;
  rateUpMultiplier: number; // 2.0 = double rate
}

export interface DropRates {
  rarity1: number; // 0.60 = 60%
  rarity2: number; // 0.25 = 25%
  rarity3: number; // 0.12 = 12%
  rarity4: number; // 0.025 = 2.5%
  rarity5: number; // 0.005 = 0.5%
}

@Entity('pet_banners')
export class PetBanner {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // 'Fire Dragons Banner', 'Legendary Beasts Event'

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: ['standard', 'featured', 'limited', 'event'],
  })
  bannerType: BannerType;

  @Column()
  costPerPull: number; // Currency cost per single pull

  // Optional: use an item (ticket) as cost instead of gold. If set, each pull
  // consumes `costItemQuantity` of the specified item. If costPerPull is 0
  // and costItemId is set, the banner requires tickets (cannot be paid by gold).
  @Column({ name: 'cost_item_id', type: 'int', nullable: true })
  costItemId?: number | null;

  @Column({ name: 'cost_item_quantity', type: 'int', default: 1 })
  costItemQuantity: number;

  @Column()
  guaranteedRarity: number; // Guaranteed rarity after X pulls

  @Column()
  guaranteedPullCount: number; // How many pulls for guaranteed

  // New: support multiple configurable pity thresholds (jsonb)
  // Example: [{ "rarity": 4, "pullCount": 10 }, { "rarity": 5, "pullCount": 20 }]
  @Column({ type: 'jsonb', nullable: true })
  pityThresholds: { rarity: number; pullCount: number }[] | null;

  @Column({ type: 'jsonb' })
  featuredPets: FeaturedPet[];

  @Column({ type: 'jsonb' })
  dropRates: DropRates;

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  bannerImage: string | null;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => PetGachaPull, (pull) => pull.banner)
  pulls: PetGachaPull[];

  @OneToMany(() => UserPetBannerPity, (pity) => pity.banner)
  pityRecords: UserPetBannerPity[];

  // Helper methods
  isCurrentlyActive(): boolean {
    const now = new Date();
    return this.isActive && now >= this.startDate && now <= this.endDate;
  }

  getTimeRemaining(): {
    days: number;
    hours: number;
    minutes: number;
    expired: boolean;
  } {
    const now = new Date();
    const timeLeft = this.endDate.getTime() - now.getTime();

    if (timeLeft <= 0) {
      return { days: 0, hours: 0, minutes: 0, expired: true };
    }

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    return { days, hours, minutes, expired: false };
  }

  getRarityRate(rarity: number): number {
    switch (rarity) {
      case 1:
        return this.dropRates.rarity1;
      case 2:
        return this.dropRates.rarity2;
      case 3:
        return this.dropRates.rarity3;
      case 4:
        return this.dropRates.rarity4;
      case 5:
        return this.dropRates.rarity5;
      default:
        return 0;
    }
  }

  getFeaturedPetIds(): string[] {
    return this.featuredPets.map((fp) => fp.petId);
  }

  getFeaturedPetMultiplier(petId: string): number {
    const featured = this.featuredPets.find((fp) => fp.petId === petId);
    return featured ? featured.rateUpMultiplier : 1;
  }

  getBannerTypeEmoji(): string {
    const typeEmojis = {
      standard: '📦',
      featured: '⭐',
      limited: '💎',
      event: '🎉',
    };
    return typeEmojis[this.bannerType] || '📦';
  }

  getFormattedCost(): string {
    if (this.costItemId) {
      return `${this.costItemQuantity} vé`; // display ticket cost
    }
    if (this.costPerPull >= 1000) {
      return `${(this.costPerPull / 1000).toFixed(1)}K`;
    }
    return this.costPerPull.toString();
  }

  usesItemCost(): boolean {
    return !!this.costItemId;
  }

  validateDropRates(): boolean {
    const total = Object.values(this.dropRates).reduce(
      (sum, rate) => sum + rate,
      0,
    );
    return Math.abs(total - 1.0) < 0.001; // Allow for floating point precision
  }

  // Return configured pity thresholds, falling back to the legacy single guaranteed settings
  getPityThresholds(): { rarity: number; pullCount: number }[] {
    if (this.pityThresholds && Array.isArray(this.pityThresholds)) {
      return this.pityThresholds.slice().sort((a, b) => a.rarity - b.rarity);
    }
    // fallback to legacy single threshold
    return [
      {
        rarity: this.guaranteedRarity,
        pullCount: this.guaranteedPullCount,
      },
    ];
  }
}
