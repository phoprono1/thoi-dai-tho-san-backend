import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PetEvolution } from './pet-evolution.entity';
import { UserPet } from './user-pet.entity';

export type PetElement =
  | 'fire'
  | 'water'
  | 'earth'
  | 'air'
  | 'light'
  | 'dark'
  | 'neutral';

export interface PetBaseStats {
  strength: number;
  intelligence: number;
  dexterity: number;
  vitality: number;
  luck: number;
}

@Entity('pet_definitions')
export class PetDefinition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  petId: string; // 'fire_dragon', 'ice_phoenix', etc.

  @Column()
  name: string; // 'Rồng Lửa', 'Phượng Băng'

  @Column({ type: 'text' })
  description: string;

  @Column({ default: 1 })
  rarity: number; // 1-5 stars

  @Column({
    type: 'enum',
    enum: ['fire', 'water', 'earth', 'air', 'light', 'dark', 'neutral'],
    default: 'neutral',
  })
  element: PetElement;

  @Column({ type: 'jsonb' })
  baseStats: PetBaseStats;

  @Column({ type: 'jsonb', default: [] })
  images: string[]; // Array of image URLs for this pet

  @Column({ default: 10 })
  maxLevel: number;

  @Column({ default: 3 })
  maxEvolutionStage: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => PetEvolution, (evolution) => evolution.basePet)
  evolutions: PetEvolution[];

  @OneToMany(() => UserPet, (userPet) => userPet.petDefinition)
  userPets: UserPet[];

  // Helper methods
  getStatsAtLevel(level: number): PetBaseStats {
    const multiplier = 1 + (level - 1) * 0.1; // 10% increase per level
    return {
      strength: Math.floor(this.baseStats.strength * multiplier),
      intelligence: Math.floor(this.baseStats.intelligence * multiplier),
      dexterity: Math.floor(this.baseStats.dexterity * multiplier),
      vitality: Math.floor(this.baseStats.vitality * multiplier),
      luck: Math.floor(this.baseStats.luck * multiplier),
    };
  }

  // Get derived combat stats from core stats (using stat-converter logic)
  getDerivedStats(baseStats: PetBaseStats) {
    // Using same formulas as player combat stats
    // effective(x) = x^0.94 for diminishing returns
    const effective = (attr: number) => Math.pow(Math.max(0, attr || 0), 0.94);

    const s = effective(baseStats.strength);
    const i = effective(baseStats.intelligence);
    const d = effective(baseStats.dexterity);
    const v = effective(baseStats.vitality);
    const l = effective(baseStats.luck);

    return {
      attack: Math.floor(10 + 0.45 * s + 0.18 * d + 0.6 * i),
      magicAttack: Math.floor(10 + 0.6 * i),
      defense: Math.floor(5 + 0.5 * v),
      maxHP: Math.floor(100 + 12 * v),
      accuracy: Math.floor(0.35 * d),
      evasion: Math.floor(0.25 * d),
      critRate: Math.min(75, 0.28 * l),
      critDamage: 150 + 0.15 * l,
      armorPen: 0.02 * s,
      lifesteal: 0.03 * s,
    };
  }

  getMaxExperience(level: number): number {
    return level * 100 + Math.pow(level, 2) * 10;
  }

  getElementEmoji(): string {
    const elementEmojis = {
      fire: '🔥',
      water: '💧',
      earth: '🌍',
      air: '💨',
      light: '✨',
      dark: '🌑',
      neutral: '⚫',
    };
    return elementEmojis[this.element] || '⚫';
  }

  getRarityStars(): string {
    return '⭐'.repeat(this.rarity);
  }
}
