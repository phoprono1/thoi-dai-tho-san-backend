import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PetDefinition, PetBaseStats } from './pet-definition.entity';

export interface RequiredItem {
  itemId: number;
  quantity: number;
}

export interface RequiredPet {
  rarity: number; // Required pet rarity (3, 4, 5 stars)
  quantity: number; // How many pets needed
  allowSameSpecies?: boolean; // Can use same species as sacrifice
  specificPetIds?: string[]; // Optional: specific pet species required
}

export interface StatMultipliers {
  strength: number; // Multiplier for STR (1.5 = +50%)
  intelligence: number; // Multiplier for INT
  dexterity: number; // Multiplier for DEX
  vitality: number; // Multiplier for VIT
  luck: number; // Multiplier for LUK
}

export interface NewAbility {
  abilityId: string;
  name: string;
  description: string;
}

@Entity('pet_evolutions')
export class PetEvolution {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PetDefinition, (petDefinition) => petDefinition.evolutions)
  @JoinColumn({ name: 'basePetId' })
  basePet: PetDefinition;

  @Column()
  basePetId: number;

  @Column()
  evolutionStage: number; // 1, 2, 3...

  @Column()
  evolutionName: string; // 'Rồng Lửa Cấp 2'

  @Column({ type: 'jsonb' })
  requiredItems: RequiredItem[];

  @Column()
  requiredLevel: number;

  @Column({ type: 'jsonb' })
  requiredPets: RequiredPet[];

  @Column({ type: 'jsonb' })
  statMultipliers: StatMultipliers;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  newImages: string[]; // New skins unlocked at this evolution

  @Column({ type: 'jsonb', nullable: true })
  newAbilities: NewAbility[] | null;

  @Column({ type: 'text', nullable: true })
  evolutionDescription: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  applyStatMultipliers(baseStats: PetBaseStats): PetBaseStats {
    // Apply multipliers directly to 5 core stats
    return {
      strength: Math.floor(baseStats.strength * this.statMultipliers.strength),
      intelligence: Math.floor(
        baseStats.intelligence * this.statMultipliers.intelligence,
      ),
      dexterity: Math.floor(
        baseStats.dexterity * this.statMultipliers.dexterity,
      ),
      vitality: Math.floor(baseStats.vitality * this.statMultipliers.vitality),
      luck: Math.floor(baseStats.luck * this.statMultipliers.luck),
    };
  }

  getRequiredItemsSummary(): string {
    return this.requiredItems
      .map((item) => `Item ${item.itemId}: ${item.quantity}`)
      .join(', ');
  }

  getRequiredPetsSummary(): string {
    return this.requiredPets
      .map((pet) => `${pet.quantity}x ${pet.rarity}⭐ pets`)
      .join(', ');
  }

  getStatBoostSummary(): string {
    const boosts = [];
    if (this.statMultipliers.strength > 1)
      boosts.push(
        `STR +${Math.round((this.statMultipliers.strength - 1) * 100)}%`,
      );
    if (this.statMultipliers.intelligence > 1)
      boosts.push(
        `INT +${Math.round((this.statMultipliers.intelligence - 1) * 100)}%`,
      );
    if (this.statMultipliers.dexterity > 1)
      boosts.push(
        `DEX +${Math.round((this.statMultipliers.dexterity - 1) * 100)}%`,
      );
    if (this.statMultipliers.vitality > 1)
      boosts.push(
        `VIT +${Math.round((this.statMultipliers.vitality - 1) * 100)}%`,
      );
    if (this.statMultipliers.luck > 1)
      boosts.push(`LUK +${Math.round((this.statMultipliers.luck - 1) * 100)}%`);
    return boosts.join(', ');
  }
}
