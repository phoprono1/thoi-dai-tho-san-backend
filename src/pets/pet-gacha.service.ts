import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { PetBanner, FeaturedPet } from './pet-banner.entity';
import { PetGachaPull } from './pet-gacha-pull.entity';
import { UserPetBannerPity } from './user-pet-banner-pity.entity';
import { PetDefinition } from './pet-definition.entity';
import { UserPet } from './user-pet.entity';
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
  // If the pull was guaranteed due to a configured threshold, this is the rarity of that threshold
  triggeredGuaranteedRarity?: number | null;
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
    const petIds = banner.featuredPets.map((fp: { petId: string }) => fp.petId);

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
    triggeredRarity?: number | null,
    manager?: EntityManager,
  ): Promise<void> {
    // Increment common counters
    pity.addPull();

    if (wasGuaranteed) {
      if (triggeredRarity) {
        // Reset only the specific threshold counter
        pity.resetThreshold(triggeredRarity);
      } else {
        // Legacy behavior: reset all counters
        pity.resetPity();
      }
    }

    if (manager) {
      await manager.getRepository(UserPetBannerPity).save(pity);
    } else {
      await this.userPetBannerPityRepository.save(pity);
    }
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
      where: { rarity },
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
    manager?: EntityManager,
  ): Promise<PullResult> {
    let rarity: number = 1;
    let wasGuaranteed = false;

    // Check if guaranteed pull using multi-threshold logic
    const thresholds = banner.getPityThresholds();

    // Ensure user pity has thresholdCounters initialized (backfill from legacy pullCount)
    if (!pity.thresholdCounters) {
      pity.thresholdCounters = {};
    }
    // Ensure counters exist for all configured thresholds (handles admin adding thresholds later)
    for (const t of thresholds) {
      const key = String(t.rarity);
      if (!(key in pity.thresholdCounters)) {
        pity.thresholdCounters[key] = pity.pullCount || 0;
      }
    }

    // Prepare variable to track which threshold (if any) triggered guarantee
    let triggeredRarity: number | null = null;

    if (isGuaranteed) {
      // external forced guarantee: choose highest configured threshold as guarantee
      rarity =
        thresholds[thresholds.length - 1].rarity ?? banner.guaranteedRarity;
      wasGuaranteed = true;
      // Treat forced guarantee as triggering that highest threshold so only it will be reset
      triggeredRarity = rarity;
    } else {
      // if any threshold would be triggered by the next pull, apply the highest rarity triggered
      const triggered: { rarity: number; pullCount: number }[] = [];
      for (const t of thresholds) {
        const key = String(t.rarity);
        const current = pity.thresholdCounters[key] ?? 0;
        if (current + 1 >= t.pullCount) triggered.push(t);
      }

      if (triggered.length > 0) {
        // choose highest rarity among triggered thresholds
        triggered.sort((a, b) => b.rarity - a.rarity);
        rarity = triggered[0].rarity;
        wasGuaranteed = true;
        // record which threshold caused guarantee
        triggeredRarity = triggered[0].rarity;
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
      banner.featuredPets?.forEach((fp: FeaturedPet) => {
        featuredPetMap.set(fp.petId, fp.rateUpMultiplier ?? 1);
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

    // Always create a new user pet instance for every pull (allow duplicates)
    let userPet: UserPet | null = null;
    try {
      userPet = await this.petService.createUserPet(
        userId,
        selectedPet.id,
        manager,
      );
    } catch (error) {
      console.error(
        `[performSinglePullInternal] ERROR creating userPet userId=${userId} petDef=${selectedPet.id}`,
        error,
      );
      throw error;
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
      triggeredGuaranteedRarity:
        typeof triggeredRarity !== 'undefined' ? triggeredRarity : null,
      wasFeatured,
      isNew: true,
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

      // If banner uses an item as cost (ticket), perform the entire flow in a
      // transaction: verify & consume item, perform pull, update pity, record pull.
      // Unified transactional flow: prefer tickets, allow fallback to gold unless banner forces tickets (costPerPull === 0)
      return await this.petGachaPullRepository.manager.transaction(
        async (manager) => {
          // Re-fetch user within transaction
          const txUser = await manager
            .getRepository(User)
            .findOne({ where: { id: userId } });
          if (!txUser) throw new NotFoundException('User not found');

          // Load or create pity row within transaction
          let pity = await manager
            .getRepository(UserPetBannerPity)
            .findOne({ where: { userId, bannerId } });
          if (!pity) {
            pity = manager.getRepository(UserPetBannerPity).create({
              userId,
              bannerId,
              pullCount: 0,
              totalPulls: 0,
              lastPullDate: new Date(),
              thresholdCounters: null,
            });
            await manager.getRepository(UserPetBannerPity).save(pity);
          }

          // Determine payment method: try tickets first if configured
          const requiredQty = banner.costItemQuantity || 1;
          let useTicket = false;
          let uiRow: { id: number; quantity: number } | null = null;
          if (banner.costItemId) {
            const rawRes: unknown = await manager.query(
              'SELECT id, quantity FROM user_item WHERE "userId" = $1 AND "itemId" = $2 FOR UPDATE',
              [userId, banner.costItemId],
            );
            const res = Array.isArray(rawRes)
              ? (rawRes as Array<{ id: number; quantity: number }>)
              : [];
            uiRow = res.length > 0 ? res[0] : null;
            if (
              uiRow &&
              typeof uiRow.quantity === 'number' &&
              uiRow.quantity >= requiredQty
            ) {
              useTicket = true;
            }
          }

          // If not using ticket and banner requires tickets only, reject
          if (!useTicket && banner.costPerPull === 0 && banner.costItemId) {
            throw new BadRequestException('Insufficient tickets for pull');
          }

          // If not using ticket, ensure user has enough gold (fallback)
          if (!useTicket) {
            if (txUser.gold < banner.costPerPull)
              throw new BadRequestException('Insufficient gold for pull');
            // Deduct gold now
            txUser.gold -= banner.costPerPull;
            await manager.getRepository(User).save(txUser);
          } else {
            // consume ticket (uiRow guarded by useTicket condition)
            if (uiRow && uiRow.quantity === requiredQty) {
              await manager.query('DELETE FROM user_item WHERE id = $1', [
                uiRow.id,
              ]);
            } else if (uiRow) {
              await manager.query(
                'UPDATE user_item SET quantity = quantity - $1 WHERE id = $2',
                [requiredQty, uiRow.id],
              );
            }
          }

          // perform pull
          const result = await this.performSinglePullInternal(
            userId,
            banner,
            pity,
            false,
            manager,
          );

          // Update pity and record pull using same manager
          await this.updatePity(
            pity,
            result.wasGuaranteed,
            result.triggeredGuaranteedRarity ?? null,
            manager,
          );
          await this.recordPull(userId, banner, result, 'single', manager);

          return result;
        },
      );

      // Legacy gold-based flow removed - handled in transaction above
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

    // Run multi-pull inside a transaction to ensure atomicity
    const pulls: PullResult[] = [];

    await this.petDefinitionRepository.manager.transaction(async (manager) => {
      // Re-fetch user within transaction
      const txUser = await manager
        .getRepository(User)
        .findOne({ where: { id: userId } });
      if (!txUser) throw new NotFoundException('User not found');

      // If banner uses item cost, consume available tickets up-front and
      // fallback to gold for remaining pulls if allowed (banner.costPerPull > 0).
      let ticketsConsumed = 0;
      if (banner.costItemId) {
        const totalRequired = (banner.costItemQuantity || 1) * 10;
        const rawRes2: unknown = await manager.query(
          'SELECT id, quantity FROM user_item WHERE "userId" = $1 AND "itemId" = $2 FOR UPDATE',
          [userId, banner.costItemId],
        );
        const res2 = Array.isArray(rawRes2)
          ? (rawRes2 as Array<{ id: number; quantity: number }>)
          : [];
        const uiRow = res2.length > 0 ? res2[0] : null;
        if (uiRow && typeof uiRow.quantity === 'number' && uiRow.quantity > 0) {
          const perPullQty = banner.costItemQuantity || 1;
          // Only consume full multiples that can cover whole pulls.
          const maxFullMultiples = Math.floor(uiRow.quantity / perPullQty);
          const maxFullConsumable = maxFullMultiples * perPullQty;
          const canTake = Math.min(maxFullConsumable, totalRequired);
          ticketsConsumed = canTake;

          // Only perform a DB update/delete if we're actually consuming something
          if (canTake > 0) {
            if (uiRow.quantity === canTake) {
              await manager.query('DELETE FROM user_item WHERE id = $1', [
                uiRow.id,
              ]);
            } else {
              await manager.query(
                'UPDATE user_item SET quantity = quantity - $1 WHERE id = $2',
                [canTake, uiRow.id],
              );
            }
          }
        }

        // If banner requires tickets only and we didn't consume enough, fail
        if (ticketsConsumed < totalRequired && banner.costPerPull === 0) {
          throw new BadRequestException('Insufficient tickets for 10x pull');
        }
      }

      // After ticket consumption, if there are remaining pulls to pay with gold, deduct here.
      // Track whether we already deducted gold so we don't double-deduct later.
      let goldDeducted = false;
      const pullsCoveredByTickets = Math.floor(
        (ticketsConsumed || 0) / (banner.costItemQuantity || 1),
      );
      const remainingPulls = 10 - pullsCoveredByTickets;
      if (remainingPulls > 0) {
        const goldNeeded = remainingPulls * banner.costPerPull;
        if (txUser.gold < goldNeeded) {
          // Revert: if we already consumed tickets above, we should not leave them consumed on failure.
          throw new BadRequestException(
            'Insufficient funds (tickets+gold) for 10x pull',
          );
        }
        txUser.gold -= goldNeeded;
        await manager.getRepository(User).save(txUser);
        goldDeducted = true;
      }

      // Load or create pity row within transaction to avoid races
      let pity = await manager
        .getRepository(UserPetBannerPity)
        .findOne({ where: { userId, bannerId } });
      if (!pity) {
        pity = manager.getRepository(UserPetBannerPity).create({
          userId,
          bannerId,
          pullCount: 0,
          totalPulls: 0,
          lastPullDate: new Date(),
          thresholdCounters: null,
        });
        await manager.getRepository(UserPetBannerPity).save(pity);
      }

      for (let i = 0; i < 10; i++) {
        const result = await this.performSinglePullInternal(
          userId,
          banner,
          pity,
          false,
          manager,
        );
        pulls.push(result);

        // Update pity using transaction manager and pass triggered rarity if available
        await this.updatePity(
          pity,
          result.wasGuaranteed,
          result.triggeredGuaranteedRarity ?? null,
          manager,
        );
      }

      // Deduct cost within transaction if gold-based
      // If we didn't already deduct gold above (e.g. no ticket logic ran), and
      // the banner is not ticket-only, deduct the total cost once here.
      if (
        !goldDeducted &&
        !(
          banner.usesItemCost() ||
          (banner.costPerPull === 0 && banner.costItemId)
        )
      ) {
        txUser.gold -= totalCost;
        await manager.getRepository(User).save(txUser);
      }

      // Record pulls within transaction
      for (const r of pulls) {
        await this.recordPull(userId, banner, r, 'multi_10', manager);
      }
    });

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
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(PetGachaPull)
      : this.petGachaPullRepository;
    const pull = repo.create({
      userId,
      bannerId: banner.id,
      petObtainedId: result.petDefinition.id, // Changed from petId to petObtainedId (integer)
      pullType,
      wasGuaranteed: result.wasGuaranteed,
      wasFeatured: result.wasFeatured,
    });

    try {
      console.log(
        `[recordPull] userId=${userId} bannerId=${banner.id} petObtainedId=${result.petDefinition.id} pullType=${pullType} creating`,
      );
      const saved = await repo.save(pull);
      console.log(
        `[recordPull] userId=${userId} pullId=${saved.id} petObtainedId=${result.petDefinition.id} wasGuaranteed=${result.wasGuaranteed}`,
      );
    } catch (error) {
      console.error(
        `[recordPull] ERROR saving pull userId=${userId} bannerId=${banner.id} petObtainedId=${result.petDefinition.id}`,
        error,
      );
      throw error;
    }
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
