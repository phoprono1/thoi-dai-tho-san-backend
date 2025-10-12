import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PetBanner } from './pet-banner.entity';
import { PetGachaPull } from './pet-gacha-pull.entity';
import { UserPetBannerPity } from './user-pet-banner-pity.entity';
import { PetDefinition } from './pet-definition.entity';
import { User } from '../users/user.entity';
import { PetService } from './pet.service';

export interface PullResult {
  petId: string;
  petDefinition: PetDefinition;
  rarity: number;
  wasGuaranteed: boolean;
  wasFeatured: boolean;
  isNew: boolean;
  userPet: {
    id: number;
    petDefinitionId: number;
    petId: string;
    name: string;
    level: number;
    rarity: number;
    imageUrl?: string;
  };
}

export interface MultiPullResult {
  results: PullResult[]; // Changed from 'pulls' to 'results' to match frontend
  totalCost: number;
  guaranteedPulls: number;
  featuredPulls: number;
  newPets: number;
}

@Injectable()
export class PetGachaService {
  constructor(
    @InjectRepository(PetBanner)
    private petBannerRepository: Repository<PetBanner>,
    @InjectRepository(PetGachaPull)
    private petGachaPullRepository: Repository<PetGachaPull>,
    @InjectRepository(UserPetBannerPity)
    private userPetBannerPityRepository: Repository<UserPetBannerPity>,
    @InjectRepository(PetDefinition)
    private petDefinitionRepository: Repository<PetDefinition>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private petService: PetService,
  ) {}

  // Banner Management
  async getActiveBanners(): Promise<PetBanner[]> {
    const now = new Date();
    return this.petBannerRepository
      .createQueryBuilder('banner')
      .where('banner.isActive = :isActive', { isActive: true })
      .andWhere('banner.startDate <= :now', { now })
      .andWhere('banner.endDate > :now', { now })
      .orderBy('banner.sortOrder', 'ASC')
      .addOrderBy('banner.endDate', 'ASC')
      .getMany();
  }

  async getBannerById(bannerId: number): Promise<PetBanner> {
    const banner = await this.petBannerRepository.findOne({
      where: { id: bannerId },
    });

    if (!banner) {
      throw new NotFoundException(`Banner with ID ${bannerId} not found`);
    }

    if (!banner.isCurrentlyActive()) {
      throw new BadRequestException('Banner is not currently active');
    }

    return banner;
  }

  async getFeaturedPetsForBanner(bannerId: number): Promise<PetDefinition[]> {
    const banner = await this.getBannerById(bannerId);

    if (!banner.featuredPets || banner.featuredPets.length === 0) {
      return [];
    }

    // Extract petIds from featuredPets array
    const petIds = banner.featuredPets.map((fp: any) => fp.petId);

    // Fetch pet definitions
    const pets = await this.petDefinitionRepository
      .createQueryBuilder('pet')
      .where('pet.petId IN (:...petIds)', { petIds })
      .getMany();

    return pets;
  }

  // Pity System
  async getUserPity(
    userId: number,
    bannerId: number,
  ): Promise<UserPetBannerPity> {
    let pity = await this.userPetBannerPityRepository.findOne({
      where: { userId, bannerId },
    });

    if (!pity) {
      pity = this.userPetBannerPityRepository.create({
        userId,
        bannerId,
        pullCount: 0,
        totalPulls: 0,
        lastPullDate: new Date(),
      });
      await this.userPetBannerPityRepository.save(pity);
    }

    return pity;
  }

  async updatePity(
    pity: UserPetBannerPity,
    wasGuaranteed: boolean,
  ): Promise<void> {
    pity.addPull();

    if (wasGuaranteed) {
      pity.resetPity();
    }

    await this.userPetBannerPityRepository.save(pity);
  }

  // Gacha Logic
  private async selectRandomPet(banner: PetBanner): Promise<{
    rarity: number;
    petDefinition: PetDefinition;
  }> {
    const random = Math.random();
    let rarity = 1;

    // Determine rarity based on drop rates
    let cumulativeRate = 0;
    for (let r = 5; r >= 1; r--) {
      cumulativeRate += banner.getRarityRate(r);
      if (random <= cumulativeRate) {
        rarity = r;
        break;
      }
    }

    // Get available pets of this rarity from the database
    const availablePets = await this.petDefinitionRepository.find({
      where: { rarity: rarity as any },
    });

    if (availablePets.length === 0) {
      throw new Error(`No pets available for rarity ${rarity}`);
    }

    // Select a random pet from available pets
    const selectedPet =
      availablePets[Math.floor(Math.random() * availablePets.length)];

    return {
      rarity,
      petDefinition: selectedPet,
    };
  }

  private async performSinglePullInternal(
    userId: number,
    banner: PetBanner,
    pity: UserPetBannerPity,
    isGuaranteed = false,
  ): Promise<PullResult> {
    let rarity: number = 1;
    let wasGuaranteed = false;

    // Check if guaranteed pull
    if (isGuaranteed || pity.isGuaranteedNext(banner)) {
      rarity = banner.guaranteedRarity;
      wasGuaranteed = true;
    } else {
      // Normal pull logic
      const random = Math.random();
      let cumulativeRate = 0;

      for (let r = 5; r >= 1; r--) {
        cumulativeRate += banner.getRarityRate(r);
        if (random <= cumulativeRate) {
          rarity = r;
          break;
        }
      }
    }

    // Get available pets of this rarity
    let availablePets = await this.petDefinitionRepository.find({
      where: { rarity, isActive: true },
    });

    // Fallback: If no pets for this rarity, try higher rarities first, then any available
    if (availablePets.length === 0) {
      console.warn(
        `⚠️ No pets available for rarity ${rarity}, trying fallback...`,
      );

      // Try higher rarities first (better for player)
      for (
        let fallbackRarity = rarity + 1;
        fallbackRarity <= 5;
        fallbackRarity++
      ) {
        availablePets = await this.petDefinitionRepository.find({
          where: { rarity: fallbackRarity, isActive: true },
        });
        if (availablePets.length > 0) {
          console.log(`✅ Fallback to rarity ${fallbackRarity}`);
          rarity = fallbackRarity;
          break;
        }
      }

      // If still no pets, try lower rarities
      if (availablePets.length === 0) {
        for (
          let fallbackRarity = rarity - 1;
          fallbackRarity >= 1;
          fallbackRarity--
        ) {
          availablePets = await this.petDefinitionRepository.find({
            where: { rarity: fallbackRarity, isActive: true },
          });
          if (availablePets.length > 0) {
            console.log(`✅ Fallback to rarity ${fallbackRarity}`);
            rarity = fallbackRarity;
            break;
          }
        }
      }

      // If STILL no pets at all, throw error
      if (availablePets.length === 0) {
        throw new BadRequestException(
          'No pets available in the system. Please contact administrator.',
        );
      }
    }

    // Select pet with weighted rate-up multipliers if featured pets exist
    let selectedPet: PetDefinition;
    let wasFeatured = false;

    const featuredPets = availablePets.filter((pet) =>
      banner.getFeaturedPetIds().includes(pet.petId),
    );

    if (featuredPets.length > 0) {
      // Use weighted selection based on rateUpMultiplier
      const featuredPetMap = new Map<string, number>();
      banner.featuredPets?.forEach((fp: any) => {
        featuredPetMap.set(fp.petId, fp.rateUpMultiplier || 1);
      });

      // Build weighted pool
      const weightedPool: { pet: PetDefinition; weight: number }[] = [];

      // Add featured pets with their multipliers
      featuredPets.forEach((pet) => {
        const multiplier = featuredPetMap.get(pet.petId) || 1;
        weightedPool.push({ pet, weight: multiplier });
      });

      // Add non-featured pets with base weight of 1
      const nonFeaturedPets = availablePets.filter(
        (pet) => !banner.getFeaturedPetIds().includes(pet.petId),
      );
      nonFeaturedPets.forEach((pet) => {
        weightedPool.push({ pet, weight: 1 });
      });

      // Calculate total weight
      const totalWeight = weightedPool.reduce(
        (sum, item) => sum + item.weight,
        0,
      );

      // Weighted random selection
      let random = Math.random() * totalWeight;
      for (const item of weightedPool) {
        random -= item.weight;
        if (random <= 0) {
          selectedPet = item.pet;
          wasFeatured = banner.getFeaturedPetIds().includes(item.pet.petId);
          break;
        }
      }

      // Fallback if something went wrong
      if (!selectedPet) {
        selectedPet =
          availablePets[Math.floor(Math.random() * availablePets.length)];
      }
    } else {
      // No featured pets, select randomly from all available
      selectedPet =
        availablePets[Math.floor(Math.random() * availablePets.length)];
    }

    // Check if user already has this pet
    const existingPets = await this.petService.getUserPets(userId);
    const isNew = !existingPets.some(
      (pet) => pet.petDefinition.petId === selectedPet.petId,
    );

    // Create or get user pet
    let userPet: any;
    if (isNew) {
      userPet = await this.petService.createUserPet(userId, selectedPet.id);
    } else {
      // Find existing user pet
      userPet = existingPets.find(
        (pet) => pet.petDefinition.petId === selectedPet.petId,
      );
    }

    // Ensure userPet exists
    if (!userPet) {
      throw new Error('Failed to create or find user pet');
    }

    return {
      petId: selectedPet.petId,
      petDefinition: selectedPet,
      rarity,
      wasGuaranteed,
      wasFeatured,
      isNew,
      userPet: {
        id: userPet.id,
        petDefinitionId: selectedPet.id,
        petId: selectedPet.petId,
        name: selectedPet.name,
        level: userPet.level,
        rarity: selectedPet.rarity,
        imageUrl: selectedPet.images?.[0] || null,
      },
    };
  }

  // Single Pull
  async performSinglePull(
    userId: number,
    bannerId: number,
  ): Promise<PullResult> {
    try {
      console.log('🎰 performSinglePull:', { userId, bannerId });

      const banner = await this.getBannerById(bannerId);
      console.log('✅ Banner found:', banner.name);

      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      console.log('✅ User found:', user.username, 'Gold:', user.gold);

      // Check if user has enough currency
      if (user.gold < banner.costPerPull) {
        throw new BadRequestException('Insufficient gold for pull');
      }

      const pity = await this.getUserPity(userId, bannerId);
      console.log('✅ Pity:', pity);

      const result = await this.performSinglePullInternal(userId, banner, pity);
      console.log('✅ Pull result:', result);

      // Deduct cost
      user.gold -= banner.costPerPull;
      await this.userRepository.save(user);
      console.log('✅ Gold deducted');

      // Update pity
      await this.updatePity(pity, result.wasGuaranteed);
      console.log('✅ Pity updated');

      // Record pull
      await this.recordPull(userId, banner, result, 'single');
      console.log('✅ Pull recorded');

      return result;
    } catch (error) {
      console.error('❌ Error in performSinglePull:', error);
      throw error;
    }
  }

  // Multi Pull (10x)
  async performMultiPull(
    userId: number,
    bannerId: number,
  ): Promise<MultiPullResult> {
    const banner = await this.getBannerById(bannerId);
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const totalCost = banner.costPerPull * 10;

    // Check if user has enough currency
    if (user.gold < totalCost) {
      throw new BadRequestException('Insufficient gold for 10x pull');
    }

    const pity = await this.getUserPity(userId, bannerId);
    const pulls: PullResult[] = [];

    // Perform 10 pulls
    for (let i = 0; i < 10; i++) {
      // Do NOT force a guaranteed high-rarity within a 10x pull.
      // Pity/guarantee behavior should be controlled by banner.guaranteedPullCount
      // and user-specific pity records. This respects admin settings.
      const result = await this.performSinglePullInternal(
        userId,
        banner,
        pity,
        false,
      );
      pulls.push(result);

      // Update pity after each pull
      await this.updatePity(pity, result.wasGuaranteed);
    }

    // Deduct cost
    user.gold -= totalCost;
    await this.userRepository.save(user);

    // Record pulls
    for (let i = 0; i < pulls.length; i++) {
      await this.recordPull(userId, banner, pulls[i], 'multi_10');
    }

    const stats = {
      totalCost,
      guaranteedPulls: pulls.filter((p) => p.wasGuaranteed).length,
      featuredPulls: pulls.filter((p) => p.wasFeatured).length,
      newPets: pulls.filter((p) => p.isNew).length,
    };

    return {
      results: pulls, // Frontend expects 'results' not 'pulls'
      ...stats,
    };
  }

  // Pull History
  private async recordPull(
    userId: number,
    banner: PetBanner,
    result: PullResult,
    pullType: 'single' | 'multi_10' | 'guaranteed',
  ): Promise<void> {
    const pull = this.petGachaPullRepository.create({
      userId,
      bannerId: banner.id,
      petObtainedId: result.petDefinition.id, // Changed from petId to petObtainedId (integer)
      pullType,
      wasGuaranteed: result.wasGuaranteed,
      wasFeatured: result.wasFeatured,
    });

    await this.petGachaPullRepository.save(pull);
  }

  async getUserPullHistory(
    userId: number,
    bannerId?: number,
    limit = 50,
  ): Promise<PetGachaPull[]> {
    try {
      const query = this.petGachaPullRepository
        .createQueryBuilder('pull')
        .leftJoinAndSelect('pull.banner', 'banner')
        .leftJoinAndSelect('pull.pet', 'pet')
        .where('pull.userId = :userId', { userId })
        .orderBy('pull.pulledAt', 'DESC')
        .limit(limit);

      if (bannerId) {
        query.andWhere('pull.bannerId = :bannerId', { bannerId });
      }

      return await query.getMany();
    } catch (error) {
      console.error('Error in getUserPullHistory:', error);
      throw error;
    }
  }

  // Statistics
  // TODO: Fix these methods - requires database schema update to add rarity, costPaid, petId columns
  /*
  async getUserGachaStats(userId: number): Promise<{
    totalPulls: number;
    totalSpent: number;
    petsObtained: number;
    rarityDistribution: Record<number, number>;
    featuredPulls: number;
    guaranteedPulls: number;
  }> {
    const pulls = await this.petGachaPullRepository.find({
      where: { userId },
    });

    const totalPulls = pulls.length;
    const totalSpent = pulls.reduce((sum, pull) => sum + pull.costPaid, 0);
    const petsObtained = new Set(pulls.map((pull) => pull.petId)).size;
    const featuredPulls = pulls.filter((pull) => pull.wasFeatured).length;
    const guaranteedPulls = pulls.filter((pull) => pull.wasGuaranteed).length;

    const rarityDistribution = pulls.reduce(
      (acc, pull) => {
        acc[pull.rarity] = (acc[pull.rarity] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    return {
      totalPulls,
      totalSpent,
      petsObtained,
      rarityDistribution,
      featuredPulls,
      guaranteedPulls,
    };
  }

  // Banner Statistics (for admins)
  async getBannerStats(bannerId: number): Promise<{
    totalPulls: number;
    uniqueUsers: number;
    totalRevenue: number;
    rarityDistribution: Record<number, number>;
    topPets: Array<{ petId: string; count: number }>;
  }> {
    const pulls = await this.petGachaPullRepository.find({
      where: { bannerId },
    });

    const totalPulls = pulls.length;
    const uniqueUsers = new Set(pulls.map((pull) => pull.userId)).size;
    const totalRevenue = pulls.reduce((sum, pull) => sum + pull.costPaid, 0);

    const rarityDistribution = pulls.reduce(
      (acc, pull) => {
        acc[pull.rarity] = (acc[pull.rarity] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    const petCounts = pulls.reduce(
      (acc, pull) => {
        acc[pull.petId] = (acc[pull.petId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const topPets = Object.entries(petCounts)
      .map(([petId, count]) => ({ petId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalPulls,
      uniqueUsers,
      totalRevenue,
      rarityDistribution,
      topPets,
    };
  }
  */
}
