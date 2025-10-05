import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { PetDefinition } from './pet-definition.entity';

export interface UserPetStats {
  strength: number;
  intelligence: number;
  dexterity: number;
  vitality: number;
  luck: number;
}

@Entity('user_pets')
export class UserPet {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => PetDefinition, (petDefinition) => petDefinition.userPets, {
    eager: true,
  })
  @JoinColumn({ name: 'petDefinitionId' })
  petDefinition: PetDefinition;

  @Column()
  petDefinitionId: number;

  @Column({ default: 1 })
  level: number;

  @Column({ default: 0 })
  experience: number;

  @Column({ default: 0 })
  evolutionStage: number;

  @Column({ default: 0 })
  currentSkinIndex: number; // Index in images array

  @Column({ type: 'jsonb', default: () => "'[]'" })
  unlockedSkins: number[]; // Indices of unlocked skins

  @Column({ default: false })
  isActive: boolean; // Currently summoned/active

  @Column({ type: 'jsonb', nullable: true })
  currentStats: UserPetStats | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  equippedItems: Record<string, number | null>; // { collar: itemId, armor: itemId, accessory: itemId, weapon: itemId }

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  unlockedAbilities: string[]; // Array of ability IDs unlocked for this pet

  @Column({ type: 'jsonb', default: () => "'{}'" })
  abilityCooldowns: Record<string, number>; // { abilityId: turnsRemaining }

  @Column({ default: 0 })
  friendship: number; // 0-100, affects performance

  @CreateDateColumn()
  obtainedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  calculateCurrentStats(): UserPetStats {
    if (!this.petDefinition) {
      // Return default stats if pet definition not loaded
      return {
        strength: 10,
        intelligence: 10,
        dexterity: 10,
        vitality: 10,
        luck: 10,
      };
    }

    // 1. Base stats from definition + level scaling
    const baseStats = this.petDefinition.getStatsAtLevel(this.level);

    // 2. Equipment bonuses (calculated from equipped items)
    // Note: Equipment items must be loaded separately via PetService.getEquipmentStatBonus()
    // This method just uses the base stats if equipment data isn't available
    const equipmentBonus = {
      strength: 0,
      intelligence: 0,
      dexterity: 0,
      vitality: 0,
      luck: 0,
    };

    // 3. Friendship bonus (0-10% at max friendship)
    const friendshipBonus = 1 + (this.friendship / 100) * 0.1;

    return {
      strength: Math.floor(
        (baseStats.strength + equipmentBonus.strength) * friendshipBonus,
      ),
      intelligence: Math.floor(
        (baseStats.intelligence + equipmentBonus.intelligence) *
          friendshipBonus,
      ),
      dexterity: Math.floor(
        (baseStats.dexterity + equipmentBonus.dexterity) * friendshipBonus,
      ),
      vitality: Math.floor(
        (baseStats.vitality + equipmentBonus.vitality) * friendshipBonus,
      ),
      luck: Math.floor(
        (baseStats.luck + equipmentBonus.luck) * friendshipBonus,
      ),
    };
  }

  // Calculate current stats WITH equipment bonuses (requires loaded items)
  calculateCurrentStatsWithEquipment(
    equippedItems: Record<string, any>,
  ): UserPetStats {
    if (!this.petDefinition) {
      // Return default stats if pet definition not loaded
      return {
        strength: 10,
        intelligence: 10,
        dexterity: 10,
        vitality: 10,
        luck: 10,
      };
    }

    // 1. Base stats from definition + level scaling
    const baseStats = this.petDefinition.getStatsAtLevel(this.level);

    // 2. Equipment bonuses from loaded items
    const equipmentBonus = {
      strength: 0,
      intelligence: 0,
      dexterity: 0,
      vitality: 0,
      luck: 0,
    };

    // Sum stats from all equipped items
    for (const item of Object.values(equippedItems)) {
      if (item && item.stats) {
        equipmentBonus.strength += item.stats.strength || 0;
        equipmentBonus.intelligence += item.stats.intelligence || 0;
        equipmentBonus.dexterity += item.stats.dexterity || 0;
        equipmentBonus.vitality += item.stats.vitality || 0;
        equipmentBonus.luck += item.stats.luck || 0;
      }
    }

    // 3. Friendship bonus (0-10% at max friendship)
    const friendshipBonus = 1 + (this.friendship / 100) * 0.1;

    return {
      strength: Math.floor(
        (baseStats.strength + equipmentBonus.strength) * friendshipBonus,
      ),
      intelligence: Math.floor(
        (baseStats.intelligence + equipmentBonus.intelligence) *
          friendshipBonus,
      ),
      dexterity: Math.floor(
        (baseStats.dexterity + equipmentBonus.dexterity) * friendshipBonus,
      ),
      vitality: Math.floor(
        (baseStats.vitality + equipmentBonus.vitality) * friendshipBonus,
      ),
      luck: Math.floor(
        (baseStats.luck + equipmentBonus.luck) * friendshipBonus,
      ),
    };
  }

  // Get stat buff that this pet provides to player (when active)
  getPlayerStatBuff(): UserPetStats {
    if (!this.isActive) {
      return {
        strength: 0,
        intelligence: 0,
        dexterity: 0,
        vitality: 0,
        luck: 0,
      };
    }

    // Use getter to get current stats (will calculate if currentStats is null)
    const currentStats = this.stats;

    // Pet provides 20% of its stats as buff to player
    const buffMultiplier = 0.2;

    return {
      strength: Math.floor(currentStats.strength * buffMultiplier),
      intelligence: Math.floor(currentStats.intelligence * buffMultiplier),
      dexterity: Math.floor(currentStats.dexterity * buffMultiplier),
      vitality: Math.floor(currentStats.vitality * buffMultiplier),
      luck: Math.floor(currentStats.luck * buffMultiplier),
    };
  }

  updateCurrentStats(): void {
    this.currentStats = this.calculateCurrentStats();
  }

  addExperience(amount: number): boolean {
    this.experience += amount;
    const maxExp = this.petDefinition.getMaxExperience(this.level);

    if (this.experience >= maxExp && this.level < this.petDefinition.maxLevel) {
      this.experience -= maxExp;
      this.level++;
      this.updateCurrentStats();
      return true; // Level up occurred
    }

    return false; // No level up
  }

  getExperiencePercentage(): number {
    if (this.level >= this.petDefinition.maxLevel) return 100;
    const maxExp = this.petDefinition.getMaxExperience(this.level);
    return Math.floor((this.experience / maxExp) * 100);
  }

  addFriendship(amount: number): void {
    this.friendship = Math.min(100, this.friendship + amount);
    this.updateCurrentStats();
  }

  unlockSkin(skinIndex: number): void {
    if (!this.unlockedSkins.includes(skinIndex)) {
      this.unlockedSkins.push(skinIndex);
    }
  }

  changeSkin(skinIndex: number): boolean {
    if (this.unlockedSkins.includes(skinIndex)) {
      this.currentSkinIndex = skinIndex;
      return true;
    }
    return false;
  }

  getCurrentSkinUrl(): string {
    if (!this.petDefinition || !this.petDefinition.images) {
      return '/assets/pets/default.png';
    }

    const imageIndex = Math.min(
      this.currentSkinIndex,
      this.petDefinition.images.length - 1,
    );
    return this.petDefinition.images[imageIndex] || '/assets/pets/default.png';
  }

  getStatusInfo(): {
    level: number;
    expPercentage: number;
    friendship: number;
    evolutionStage: number;
    isMaxLevel: boolean;
  } {
    return {
      level: this.level,
      expPercentage: this.getExperiencePercentage(),
      friendship: this.friendship,
      evolutionStage: this.evolutionStage,
      isMaxLevel: this.level >= this.petDefinition.maxLevel,
    };
  }

  getPowerLevel(): number {
    const stats = this.calculateCurrentStats();

    // Calculate power from core stats (simple sum with weights)
    return (
      stats.strength * 2 +
      stats.intelligence * 2 +
      stats.dexterity * 1.5 +
      stats.vitality * 1.5 +
      stats.luck * 1
    );
  }

  // Add imageUrl as getter for JSON serialization
  get imageUrl(): string {
    return this.getCurrentSkinUrl();
  }

  // Get pet display name (use petDefinition name)
  get name(): string {
    return this.petDefinition?.name || 'Unknown Pet';
  }

  // Get pet rarity from definition
  get rarity(): number {
    return this.petDefinition?.rarity || 1;
  }

  // Get max HP from current stats (using vitality formula: 100 + 12 * effective(VIT))
  get maxHp(): number {
    if (!this.currentStats) return 500;

    const effective = (attr: number) => Math.pow(Math.max(0, attr || 0), 0.94);
    const v = effective(this.currentStats.vitality);
    return Math.floor(100 + 12 * v);
  }

  // Get current HP (same as maxHp for now, can be modified in combat)
  get currentHp(): number {
    return this.maxHp;
  }

  // Get petId from definition
  get petId(): string {
    return this.petDefinition?.petId || '';
  }

  // Get current stats as simple object
  get stats(): UserPetStats {
    return this.currentStats || this.calculateCurrentStats();
  }

  // ===== PET ABILITY METHODS =====

  /**
   * Get available abilities for this pet (unlocked + off cooldown)
   */
  getAvailableAbilities(): string[] {
    if (!this.unlockedAbilities || this.unlockedAbilities.length === 0) {
      return [];
    }

    // Filter out abilities that are on cooldown
    return this.unlockedAbilities.filter((abilityId) => {
      const cooldown = this.abilityCooldowns?.[abilityId] || 0;
      return cooldown <= 0;
    });
  }

  /**
   * Check if pet can use a specific ability
   */
  canUseAbility(abilityId: string): boolean {
    // Check if ability is unlocked
    if (
      !this.unlockedAbilities ||
      !this.unlockedAbilities.includes(abilityId)
    ) {
      return false;
    }

    // Check if ability is off cooldown
    const cooldown = this.abilityCooldowns?.[abilityId] || 0;
    return cooldown <= 0;
  }

  /**
   * Set ability cooldown after use
   */
  setAbilityCooldown(abilityId: string, turns: number): void {
    if (!this.abilityCooldowns) {
      this.abilityCooldowns = {};
    }
    this.abilityCooldowns[abilityId] = turns;
  }

  /**
   * Reduce all ability cooldowns by 1 turn (call at end of combat turn)
   */
  reduceCooldowns(): void {
    if (!this.abilityCooldowns) {
      this.abilityCooldowns = {};
      return;
    }

    for (const abilityId in this.abilityCooldowns) {
      if (this.abilityCooldowns[abilityId] > 0) {
        this.abilityCooldowns[abilityId]--;
      }
    }
  }

  /**
   * Unlock a new ability (e.g., after evolution)
   */
  unlockAbility(abilityId: string): void {
    if (!this.unlockedAbilities) {
      this.unlockedAbilities = [];
    }

    if (!this.unlockedAbilities.includes(abilityId)) {
      this.unlockedAbilities.push(abilityId);
    }
  }
}
