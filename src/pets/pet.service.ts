/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, EntityManager } from 'typeorm';
import { PetDefinition } from './pet-definition.entity';
import { UserPet } from './user-pet.entity';
import { PetEvolution } from './pet-evolution.entity';
import { PetUpgradeMaterial } from './pet-upgrade-material.entity';
import { User } from '../users/user.entity';
import { UserItem } from '../user-items/user-item.entity';
import { Item } from '../items/item.entity';
import { PetAbility } from './entities/pet-ability.entity';
import {
  isPetEquipmentType,
  slotMatchesItemType,
  getPetEquipmentSlot,
} from '../items/item-types.enum';

@Injectable()
export class PetService {
  constructor(
    @InjectRepository(PetDefinition)
    private petDefinitionRepository: Repository<PetDefinition>,
    @InjectRepository(UserPet)
    private userPetRepository: Repository<UserPet>,
    @InjectRepository(PetEvolution)
    private petEvolutionRepository: Repository<PetEvolution>,
    @InjectRepository(PetUpgradeMaterial)
    private petUpgradeMaterialRepository: Repository<PetUpgradeMaterial>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserItem)
    private userItemRepository: Repository<UserItem>,
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    @InjectRepository(PetAbility)
    private petAbilityRepository: Repository<PetAbility>,
  ) {}

  // Pet Definition Management
  async getAllPetDefinitions(
    includeInactive = false,
  ): Promise<PetDefinition[]> {
    try {
      const query = this.petDefinitionRepository
        .createQueryBuilder('pet')
        .leftJoinAndSelect('pet.evolutions', 'evolutions')
        .orderBy('pet.sortOrder', 'ASC')
        .addOrderBy('pet.rarity', 'DESC');

      if (!includeInactive) {
        query.andWhere('pet.isActive = :isActive', { isActive: true });
      }

      return await query.getMany();
    } catch (error) {
      console.error('Error in getAllPetDefinitions:', error);
      // Fallback: Try without evolutions join
      try {
        const query = this.petDefinitionRepository
          .createQueryBuilder('pet')
          .orderBy('pet.sortOrder', 'ASC')
          .addOrderBy('pet.rarity', 'DESC');

        if (!includeInactive) {
          query.andWhere('pet.isActive = :isActive', { isActive: true });
        }

        return await query.getMany();
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  async getPetDefinitionById(id: number): Promise<PetDefinition> {
    const pet = await this.petDefinitionRepository.findOne({
      where: { id },
      relations: ['evolutions', 'userPets'],
    });

    if (!pet) {
      throw new NotFoundException(`Pet definition with ID ${id} not found`);
    }

    return pet;
  }

  async getPetDefinitionByPetId(petId: string): Promise<PetDefinition> {
    const pet = await this.petDefinitionRepository.findOne({
      where: { petId },
      relations: ['evolutions'],
    });

    if (!pet) {
      throw new NotFoundException(`Pet with petId ${petId} not found`);
    }

    return pet;
  }

  // User Pet Management
  async getUserPets(
    userId: number,
    includeInactive = false,
    limit?: number,
    offset?: number,
    options?: {
      element?: string;
      minRarity?: number;
      maxRarity?: number;
      sort?: 'rarity_desc' | 'rarity_asc' | 'newest' | 'oldest';
    },
  ): Promise<UserPet[]> {
    try {
      console.log(
        `[getUserPets] userId=${userId}, includeInactive=${includeInactive}`,
      );

      // Check if user has any active pet
      const activePetCount = await this.userPetRepository.count({
        where: { userId, isActive: true },
      });

      console.log(`[getUserPets] activePetCount=${activePetCount}`);

      // If no active pet, auto-activate the first pet (highest level or most recent)
      if (activePetCount === 0) {
        const firstPet = await this.userPetRepository.findOne({
          where: { userId },
          order: { level: 'DESC', obtainedAt: 'DESC' },
        });

        if (firstPet) {
          firstPet.isActive = true;
          await this.userPetRepository.save(firstPet);
        }
      }

      // Build optimized query with pagination and filters
      const query = this.userPetRepository
        .createQueryBuilder('userPet')
        .leftJoinAndSelect('userPet.petDefinition', 'petDefinition')
        .where('userPet.userId = :userId', { userId });

      // Apply inactive filter
      if (!includeInactive) {
        query.andWhere('userPet.isActive = :isActive', { isActive: true });
      }

      // Apply element filter
      if (options?.element) {
        query.andWhere('petDefinition.element = :element', {
          element: options.element,
        });
      }

      // Apply rarity filters
      if (options?.minRarity !== undefined) {
        query.andWhere('petDefinition.rarity >= :minRarity', {
          minRarity: options.minRarity,
        });
      }
      if (options?.maxRarity !== undefined) {
        query.andWhere('petDefinition.rarity <= :maxRarity', {
          maxRarity: options.maxRarity,
        });
      }

      // Apply sorting
      if (options?.sort === 'rarity_desc') {
        query.orderBy('petDefinition.rarity', 'DESC');
      } else if (options?.sort === 'rarity_asc') {
        query.orderBy('petDefinition.rarity', 'ASC');
      } else if (options?.sort === 'newest') {
        query.orderBy('userPet.obtainedAt', 'DESC');
      } else if (options?.sort === 'oldest') {
        query.orderBy('userPet.obtainedAt', 'ASC');
      } else {
        // Default ordering: active first, then level, then newest
        query
          .orderBy('userPet.isActive', 'DESC')
          .addOrderBy('userPet.level', 'DESC')
          .addOrderBy('userPet.obtainedAt', 'DESC');
      }

      if (limit) {
        query.take(limit);
      }

      if (offset) {
        query.skip(offset);
      }

      const pets = await query.getMany();
      console.log(`[getUserPets] Found ${pets.length} pets`);

      // Transform to plain objects for frontend
      const transformedPets = await Promise.all(
        pets.map(async (pet) => {
          try {
            // Fetch equipped items for each pet
            const equipment: any[] = [];
            if (pet.equippedItems) {
              for (const [slot, itemId] of Object.entries(pet.equippedItems)) {
                if (itemId) {
                  try {
                    const item = await this.itemRepository.findOne({
                      where: { id: Number(itemId) },
                    });
                    if (item) {
                      equipment.push({
                        id: item.id.toString(),
                        name: item.name,
                        slot: slot as
                          | 'collar'
                          | 'armor'
                          | 'accessory'
                          | 'weapon',
                        iconImage: item.image || '',
                        stats: item.stats,
                      });
                    }
                  } catch (itemError) {
                    console.error(
                      `Error fetching item ${itemId} for pet ${pet.id}:`,
                      itemError,
                    );
                    // Continue with other items
                  }
                }
              }
            }

            // Fetch unlocked abilities with full details
            const abilities: any[] = [];
            if (pet.unlockedAbilities && pet.unlockedAbilities.length > 0) {
              try {
                // Convert string IDs to numbers
                const abilityIds = pet.unlockedAbilities
                  .map((id) => parseInt(id, 10))
                  .filter((id) => !isNaN(id));

                if (abilityIds.length > 0) {
                  const abilityEntities = await this.petAbilityRepository.find({
                    where: { id: In(abilityIds) },
                  });

                  for (const ability of abilityEntities) {
                    abilities.push({
                      id: ability.id,
                      name: ability.name,
                      type: ability.type,
                      description: ability.description,
                      effects: ability.effects,
                      cooldown: ability.cooldown,
                      manaCost: ability.manaCost,
                      targetType: ability.targetType,
                      icon: ability.icon,
                      rarity: ability.rarity,
                      currentCooldown: pet.abilityCooldowns?.[ability.id] || 0,
                    });
                  }
                }
              } catch (abilityError) {
                console.error(
                  `Error fetching abilities for pet ${pet.id}:`,
                  abilityError,
                );
                // Continue without abilities
              }
            }

            // Return plain object with all needed properties
            return {
              ...pet,
              equipment,
              abilities,
              imageUrl: pet.getCurrentSkinUrl(),
              name: pet.petDefinition?.name || 'Unknown Pet',
              petId: pet.petDefinition?.petId || '',
              rarity: pet.petDefinition?.rarity || 1,
              maxHp: pet.maxHp,
              currentHp: pet.maxHp,
              stats: pet.currentStats || pet.calculateCurrentStats(),
            } as any;
          } catch (error) {
            console.error(`Error transforming pet ${pet.id}:`, error);
            // Return minimal pet data
            return {
              ...pet,
              equipment: [],
              imageUrl: '/assets/pets/default.png',
              name: pet.petDefinition?.name || 'Unknown Pet',
              petId: pet.petDefinition?.petId || '',
              rarity: pet.petDefinition?.rarity || 1,
              maxHp: 500,
              currentHp: 500,
              stats: {
                strength: 0,
                intelligence: 0,
                dexterity: 0,
                vitality: 0,
                luck: 0,
              },
            } as any;
          }
        }),
      );

      console.log(
        `[getUserPets] Transformed ${transformedPets.length} pets successfully`,
      );
      return transformedPets as any;
    } catch (error) {
      console.error('[getUserPets] Fatal error:', error);
      throw error;
    }
  }

  async getUserPet(petId: number, userId: number): Promise<UserPet> {
    const userPet = await this.userPetRepository.findOne({
      where: { id: petId, userId },
      relations: ['petDefinition', 'petDefinition.evolutions'],
    });

    if (!userPet) {
      throw new NotFoundException(
        `Pet with ID ${petId} not found for user ${userId}`,
      );
    }

    return userPet;
  }

  async getUserPetWithDetails(petId: number, userId: number): Promise<any> {
    const userPet = await this.getUserPet(petId, userId);

    // Fetch equipped items with full details
    const equipment: any[] = [];
    if (userPet.equippedItems) {
      for (const [slot, itemId] of Object.entries(userPet.equippedItems)) {
        if (itemId) {
          const item = await this.itemRepository.findOne({
            where: { id: Number(itemId) },
          });
          if (item) {
            equipment.push({
              id: item.id.toString(),
              name: item.name,
              slot: slot as 'collar' | 'armor' | 'accessory' | 'weapon',
              iconImage: item.image || '',
              stats: item.stats,
            });
          }
        }
      }
    }

    // Fetch unlocked abilities with full details
    const abilities: any[] = [];
    if (userPet.unlockedAbilities && userPet.unlockedAbilities.length > 0) {
      // Convert string IDs to numbers
      const abilityIds = userPet.unlockedAbilities
        .map((id) => parseInt(id, 10))
        .filter((id) => !isNaN(id));

      if (abilityIds.length > 0) {
        const abilityEntities = await this.petAbilityRepository.find({
          where: { id: In(abilityIds) },
        });

        for (const ability of abilityEntities) {
          abilities.push({
            id: ability.id,
            name: ability.name,
            type: ability.type,
            description: ability.description,
            effects: ability.effects,
            cooldown: ability.cooldown,
            manaCost: ability.manaCost,
            targetType: ability.targetType,
            icon: ability.icon,
            rarity: ability.rarity,
            currentCooldown: userPet.abilityCooldowns?.[ability.id] || 0,
          });
        }
      }
    }

    return {
      ...userPet,
      imageUrl: userPet.getCurrentSkinUrl(),
      name: userPet.petDefinition?.name || 'Unknown Pet',
      petId: userPet.petDefinition?.petId || '',
      rarity: userPet.petDefinition?.rarity || 1,
      maxHp: userPet.maxHp,
      currentHp: userPet.maxHp,
      stats: userPet.currentStats || userPet.calculateCurrentStats(),
      equipment,
      abilities,
    };
  }

  async getActivePet(userId: number): Promise<UserPet | null> {
    return this.userPetRepository.findOne({
      where: { userId, isActive: true },
      relations: ['petDefinition'],
    });
  }

  async setActivePet(userId: number, petId: number): Promise<UserPet> {
    // Deactivate current active pet
    await this.userPetRepository.update(
      { userId, isActive: true },
      { isActive: false },
    );

    // Set new active pet
    const userPet = await this.getUserPet(petId, userId);
    userPet.isActive = true;
    await this.userPetRepository.save(userPet);

    return userPet;
  }

  // Pet Experience & Leveling
  async addExperience(
    petId: number,
    userId: number,
    expAmount: number,
  ): Promise<UserPet> {
    const userPet = await this.getUserPet(petId, userId);
    const petDefinition = userPet.petDefinition;

    let currentExp = userPet.experience + expAmount;
    let currentLevel = userPet.level;

    // Level up logic
    while (currentLevel < petDefinition.maxLevel) {
      const expForNextLevel = petDefinition.getMaxExperience(currentLevel);

      if (currentExp >= expForNextLevel) {
        currentExp -= expForNextLevel;
        currentLevel++;
      } else {
        break;
      }
    }

    userPet.experience = currentExp;
    userPet.level = currentLevel;
    userPet.updateCurrentStats();

    return this.userPetRepository.save(userPet);
  }

  async addFriendship(
    petId: number,
    userId: number,
    friendshipAmount: number,
  ): Promise<UserPet> {
    const userPet = await this.getUserPet(petId, userId);

    userPet.addFriendship(friendshipAmount);

    return this.userPetRepository.save(userPet);
  }

  // Pet Evolution
  async getAvailableEvolutions(
    petId: number,
    userId: number,
  ): Promise<PetEvolution[]> {
    const userPet = await this.getUserPet(petId, userId);

    return this.petEvolutionRepository.find({
      where: {
        basePetId: userPet.petDefinition.id,
        evolutionStage: userPet.evolutionStage + 1,
      },
    });
  }

  async canEvolvePet(
    petId: number,
    userId: number,
    evolutionId: number,
  ): Promise<{
    canEvolve: boolean;
    reasons: string[];
  }> {
    const userPet = await this.getUserPet(petId, userId);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const evolution = await this.petEvolutionRepository.findOne({
      where: { id: evolutionId },
    });

    if (!evolution || !user) {
      return { canEvolve: false, reasons: ['Evolution or user not found'] };
    }

    const reasons = [];

    // Check level requirement
    if (userPet.level < evolution.requiredLevel) {
      reasons.push(
        `Pet must be level ${evolution.requiredLevel} (currently ${userPet.level})`,
      );
    }

    // Check evolution stage
    if (userPet.evolutionStage !== evolution.evolutionStage - 1) {
      reasons.push(`Invalid evolution stage`);
    }

    // Check required items (placeholder - implement based on your item system)
    // TODO: Implement item checking logic

    // Check required pets for sacrifice
    const userPets = await this.getUserPets(userId);

    // Sort requirements by rarity (descending) to check higher rarity requirements first
    const sortedRequirements = [...evolution.requiredPets].sort(
      (a, b) => b.rarity - a.rarity,
    );

    const allocatedPetIds = new Set<number>();

    for (const reqPet of sortedRequirements) {
      const availablePets = userPets.filter((pet) => {
        // Skip if already allocated
        if (allocatedPetIds.has(pet.id)) return false;

        // Skip the pet being evolved
        if (pet.id === userPet.id) return false;

        // Check rarity requirement
        return pet.petDefinition.rarity >= reqPet.rarity;
      });

      if (availablePets.length < reqPet.quantity) {
        reasons.push(
          `Need ${reqPet.quantity} pets with ${reqPet.rarity}+ rarity (have ${availablePets.length} available)`,
        );
      } else {
        // Mark these pets as allocated
        const petsToAllocate = availablePets.slice(0, reqPet.quantity);
        petsToAllocate.forEach((pet) => allocatedPetIds.add(pet.id));
      }
    }

    return {
      canEvolve: reasons.length === 0,
      reasons,
    };
  }

  async evolvePet(
    petId: number,
    userId: number,
    evolutionId: number,
    sacrificePetIds?: number[],
  ): Promise<UserPet> {
    const userPet = await this.getUserPet(petId, userId);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const evolution = await this.petEvolutionRepository.findOne({
      where: { id: evolutionId },
    });

    if (!evolution || !user) {
      throw new BadRequestException('Evolution or user not found');
    }

    const reasons = [];

    // Check level requirement
    if (userPet.level < evolution.requiredLevel) {
      reasons.push(
        `Pet must be level ${evolution.requiredLevel} (currently ${userPet.level})`,
      );
    }

    // Check evolution stage
    if (userPet.evolutionStage !== evolution.evolutionStage - 1) {
      reasons.push(`Invalid evolution stage`);
    }

    // Throw early if basic requirements not met
    if (reasons.length > 0) {
      throw new BadRequestException(`Cannot evolve pet: ${reasons.join(', ')}`);
    }

    // Sacrifice required pets
    if (sacrificePetIds && sacrificePetIds.length > 0) {
      // Use user-selected pets
      const petsToSacrifice = await this.userPetRepository.find({
        where: { id: In(sacrificePetIds), userId },
        relations: ['petDefinition'],
      });

      // Validate selected pets meet requirements
      if (petsToSacrifice.length !== sacrificePetIds.length) {
        throw new BadRequestException('Some selected pets not found');
      }

      // Validate pet is not sacrificing itself
      if (petsToSacrifice.some((p) => p.id === userPet.id)) {
        throw new BadRequestException('Cannot sacrifice the pet being evolved');
      }

      // Validate selected pets meet evolution requirements
      // Sort requirements by rarity (descending) to allocate higher rarity pets first
      const sortedRequirements = [...evolution.requiredPets].sort(
        (a, b) => b.rarity - a.rarity,
      );

      const allocatedPetIds = new Set<number>();

      for (const reqPet of sortedRequirements) {
        // Filter pets that haven't been allocated yet
        const availablePets = petsToSacrifice.filter((pet) => {
          // Skip if already allocated
          if (allocatedPetIds.has(pet.id)) return false;

          // Check rarity requirement
          if (pet.petDefinition.rarity < reqPet.rarity) return false;

          // Check species requirement
          if (
            !reqPet.allowSameSpecies &&
            pet.petDefinitionId === userPet.petDefinitionId
          ) {
            return false;
          }

          return true;
        });

        if (availablePets.length < reqPet.quantity) {
          throw new BadRequestException(
            `Not enough pets matching requirement: ${reqPet.quantity}x ${reqPet.rarity}⭐ ${reqPet.allowSameSpecies ? '(Same species OK)' : '(Different species)'}. Available: ${availablePets.length}, need: ${reqPet.quantity}`,
          );
        }

        // Allocate the required number of pets for this requirement
        const petsToAllocate = availablePets.slice(0, reqPet.quantity);
        petsToAllocate.forEach((pet) => allocatedPetIds.add(pet.id));
      }

      await this.userPetRepository.remove(petsToSacrifice);
    } else {
      // Auto-select (old behavior)
      const userPets = await this.getUserPets(userId);
      for (const reqPet of evolution.requiredPets) {
        const petsToSacrifice = userPets
          .filter(
            (pet) =>
              pet.petDefinition.rarity >= reqPet.rarity &&
              pet.id !== userPet.id,
          )
          .slice(0, reqPet.quantity);

        await this.userPetRepository.remove(petsToSacrifice);
      }
    }

    // Apply evolution
    userPet.evolutionStage = evolution.evolutionStage;
    userPet.experience = 0; // Reset experience after evolution
    userPet.updateCurrentStats();

    // Unlock new abilities from evolution
    if (evolution.newAbilities && evolution.newAbilities.length > 0) {
      for (const abilityData of evolution.newAbilities) {
        // newAbilities can be either ability IDs (numbers) or ability objects with abilityId
        const abilityId =
          typeof abilityData === 'number'
            ? abilityData
            : (abilityData as any).abilityId;

        if (abilityId) {
          // Convert to string for storage
          const abilityIdStr = abilityId.toString();
          if (!userPet.unlockedAbilities.includes(abilityIdStr)) {
            userPet.unlockedAbilities.push(abilityIdStr);
          }
        }
      }
    }

    // Add new images if available
    if (evolution.newImages.length > 0) {
      const currentImages = userPet.petDefinition.images;
      const newSkinIndices: number[] = [];

      for (const newImageUrl of evolution.newImages) {
        // Find index of this image in petDefinition.images
        let skinIndex = currentImages.indexOf(newImageUrl);

        // If image doesn't exist in petDefinition, add it
        if (skinIndex === -1) {
          currentImages.push(newImageUrl);
          skinIndex = currentImages.length - 1;

          // Update petDefinition in database
          userPet.petDefinition.images = currentImages;
          await this.petDefinitionRepository.save(userPet.petDefinition);
        }

        // Add to unlocked skins if not already unlocked
        if (!userPet.unlockedSkins.includes(skinIndex)) {
          newSkinIndices.push(skinIndex);
        }
      }

      // Add new skin indices to unlocked skins
      if (newSkinIndices.length > 0) {
        userPet.unlockedSkins = [...userPet.unlockedSkins, ...newSkinIndices];
      }
    }

    return this.userPetRepository.save(userPet);
  }

  // Change Pet Skin
  async changeSkin(
    petId: number,
    userId: number,
    skinIndex: number,
  ): Promise<UserPet> {
    const userPet = await this.getUserPet(petId, userId);

    // Validate skin is unlocked
    if (!userPet.unlockedSkins.includes(skinIndex)) {
      throw new BadRequestException('Skin chưa được mở khóa!');
    }

    // Validate skin exists in pet definition
    if (skinIndex >= userPet.petDefinition.images.length) {
      throw new BadRequestException('Skin không tồn tại!');
    }

    userPet.currentSkinIndex = skinIndex;
    return this.userPetRepository.save(userPet);
  }

  // Pet Stats & Equipment
  async getEquippedItems(petId: number, userId: number): Promise<any> {
    const userPet = await this.getUserPet(petId, userId);

    // Return equipped items with full item details
    const equipped: Record<string, any> = {};

    for (const [slot, itemId] of Object.entries(userPet.equippedItems || {})) {
      if (itemId) {
        const item = await this.itemRepository.findOne({
          where: { id: itemId },
        });
        equipped[slot] = item;
      } else {
        equipped[slot] = null;
      }
    }

    return equipped;
  }

  async equipItem(
    petId: number,
    userId: number,
    itemId: number,
    slot: string,
  ): Promise<any> {
    const userPet = await this.getUserPet(petId, userId);

    // 1. Validate item exists
    const item = await this.itemRepository.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Item không tồn tại!');
    }

    // 2. Validate item is pet equipment
    if (!isPetEquipmentType(item.type)) {
      throw new BadRequestException('Item này không phải trang bị pet!');
    }

    // 3. Validate slot matches item type
    if (!slotMatchesItemType(slot, item.type)) {
      throw new BadRequestException(
        `Item không thể trang bị vào slot ${slot}! Phải trang bị vào slot ${getPetEquipmentSlot(item.type)}`,
      );
    }

    // 4. Validate user owns this item
    const userItem = await this.userItemRepository.findOne({
      where: { userId, itemId },
    });
    if (!userItem || userItem.quantity < 1) {
      throw new BadRequestException('Bạn không sở hữu item này!');
    }

    // 5. Equip item
    if (!userPet.equippedItems) {
      userPet.equippedItems = {};
    }
    userPet.equippedItems[slot] = itemId;

    // Update current stats with equipment bonuses
    await this.updatePetStatsWithEquipment(userPet);

    // Save and return pet with full equipment details
    await this.userPetRepository.save(userPet);

    return this.getUserPetWithDetails(petId, userId);
  }

  // Helper: Update pet stats including equipment bonuses
  private async updatePetStatsWithEquipment(userPet: UserPet): Promise<void> {
    // Fetch all equipped items
    const equippedItems: Record<string, any> = {};

    for (const [slot, itemId] of Object.entries(userPet.equippedItems || {})) {
      if (itemId) {
        const item = await this.itemRepository.findOne({
          where: { id: itemId },
        });
        equippedItems[slot] = item;
      } else {
        equippedItems[slot] = null;
      }
    }

    // Calculate stats with equipment
    userPet.currentStats =
      userPet.calculateCurrentStatsWithEquipment(equippedItems);
  }

  async unequipItem(petId: number, userId: number, slot: string): Promise<any> {
    const userPet = await this.getUserPet(petId, userId);

    if (!userPet.equippedItems) {
      userPet.equippedItems = {};
    }

    userPet.equippedItems[slot] = null;

    // Update current stats with equipment bonuses
    await this.updatePetStatsWithEquipment(userPet);

    await this.userPetRepository.save(userPet);

    // Return pet with full equipment details
    return this.getUserPetWithDetails(petId, userId);
  }

  // Pet Management
  async createUserPet(
    userId: number,
    petDefinitionId: number,
    manager?: EntityManager,
  ): Promise<UserPet> {
    const petDefinition = await this.getPetDefinitionById(petDefinitionId);

    const userPet = new UserPet();
    userPet.userId = userId;
    userPet.petDefinitionId = petDefinitionId;
    userPet.petDefinition = petDefinition;
    userPet.level = 1;
    userPet.experience = 0;
    userPet.evolutionStage = 0;
    userPet.currentSkinIndex = 0;
    userPet.unlockedSkins = [0];
    userPet.isActive = false;
    userPet.equippedItems = {};
    userPet.friendship = 0;

    userPet.updateCurrentStats();

    try {
      console.log(
        `[createUserPet] userId=${userId} petDefinitionId=${petDefinitionId} creating`,
      );
      const repo = manager
        ? manager.getRepository(UserPet)
        : this.userPetRepository;
      const saved = await repo.save(userPet);
      console.log(
        `[createUserPet] userId=${userId} petDefinitionId=${petDefinitionId} saved userPetId=${saved.id}`,
      );
      return saved;
    } catch (error) {
      console.error(
        `[createUserPet] ERROR saving userPet userId=${userId} petDefinitionId=${petDefinitionId}`,
        error,
      );
      throw error;
    }
  }

  async releasePet(petId: number, userId: number): Promise<void> {
    const userPet = await this.getUserPet(petId, userId);

    if (userPet.isActive) {
      throw new BadRequestException('Cannot release active pet');
    }

    await this.userPetRepository.remove(userPet);
  }

  // Statistics
  async getUserPetStats(userId: number): Promise<{
    totalPets: number;
    activePets: number;
    maxLevel: number;
    avgLevel: number;
    rarityDistribution: Record<number, number>;
  }> {
    const userPets = await this.getUserPets(userId, true);

    const totalPets = userPets.length;
    const activePets = userPets.filter((pet) => pet.isActive).length;
    const maxLevel = Math.max(...userPets.map((pet) => pet.level), 0);
    const avgLevel =
      totalPets > 0
        ? userPets.reduce((sum, pet) => sum + pet.level, 0) / totalPets
        : 0;

    const rarityDistribution = userPets.reduce(
      (acc, pet) => {
        const rarity = pet.petDefinition.rarity;
        acc[rarity] = (acc[rarity] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    return {
      totalPets,
      activePets,
      maxLevel,
      avgLevel: Math.round(avgLevel * 100) / 100,
      rarityDistribution,
    };
  }

  // Image upload helpers
  async addImageToPetDefinition(
    petDefinitionId: number,
    imagePath: string,
  ): Promise<PetDefinition> {
    const petDefinition = await this.petDefinitionRepository.findOne({
      where: { id: petDefinitionId },
    });

    if (!petDefinition) {
      throw new NotFoundException('Pet definition not found');
    }

    // Add image to the images array if not already present
    if (!petDefinition.images.includes(imagePath)) {
      petDefinition.images.push(imagePath);
      await this.petDefinitionRepository.save(petDefinition);
    }

    return petDefinition;
  }

  async updateBannerImage(bannerId: number, imagePath: string): Promise<void> {
    // This would typically go through a PetBannerService, but for now we'll update directly
    // Note: You might need to inject PetBannerRepository or create a separate service
    const result = await this.petDefinitionRepository.manager
      .createQueryBuilder()
      .update('pet_banners')
      .set({ bannerImage: imagePath })
      .where('id = :id', { id: bannerId })
      .execute();

    if (result.affected === 0) {
      throw new NotFoundException('Pet banner not found');
    }
  }

  async updateEquipmentIcon(
    equipmentId: string,
    iconPath: string,
  ): Promise<void> {
    // Update pet equipment icon
    const result = await this.petDefinitionRepository.manager
      .createQueryBuilder()
      .update('pet_equipment')
      .set({ image: iconPath })
      .where('id = :id', { id: equipmentId })
      .execute();

    if (result.affected === 0) {
      throw new NotFoundException('Pet equipment not found');
    }
  }

  async removePetImage(petId: number, imageIndex: number): Promise<void> {
    // Get the current pet definition
    const pet = await this.petDefinitionRepository.findOne({
      where: { id: petId },
    });

    if (!pet) {
      throw new NotFoundException('Pet definition not found');
    }

    // Remove the image at the specified index
    if (imageIndex < 0 || imageIndex >= pet.images.length) {
      throw new BadRequestException('Invalid image index');
    }

    const updatedImages = [...pet.images];
    updatedImages.splice(imageIndex, 1);

    // Update the pet definition
    await this.petDefinitionRepository.update(petId, {
      images: updatedImages,
    });
  }

  // Evolution Management Methods
  async getEvolutionsForPet(petId: string) {
    // petId is a string (e.g., 'fire_dragon'), need to find the pet definition first
    const petDef = await this.petDefinitionRepository.findOne({
      where: { petId },
    });

    if (!petDef) {
      return [];
    }

    return this.petEvolutionRepository.find({
      where: { basePetId: petDef.id },
      order: { evolutionStage: 'ASC' },
    });
  }

  async createEvolution(dto: any) {
    // If dto.petId is a string, convert to basePetId number
    if (dto.petId && typeof dto.petId === 'string') {
      const petDef = await this.petDefinitionRepository.findOne({
        where: { petId: dto.petId },
      });
      if (!petDef) {
        throw new NotFoundException('Pet definition not found');
      }
      dto.basePetId = petDef.id;
      delete dto.petId;
    }

    // Set evolutionName if not provided
    if (!dto.evolutionName) {
      const petDef = await this.petDefinitionRepository.findOne({
        where: { id: dto.basePetId },
      });
      dto.evolutionName = `${petDef?.name || 'Pet'} - Stage ${dto.evolutionStage}`;
    }

    // Set default values
    dto.evolutionDescription =
      dto.description || dto.evolutionDescription || '';
    dto.requiredItems = dto.requiredItems || [];
    dto.newAbilities = dto.newAbilities || null;

    const evolution = this.petEvolutionRepository.create(dto);
    return this.petEvolutionRepository.save(evolution);
  }

  async updateEvolution(id: number, dto: any) {
    try {
      // If dto.petId is a string, convert to basePetId number
      if (dto.petId && typeof dto.petId === 'string') {
        const petDef = await this.petDefinitionRepository.findOne({
          where: { petId: dto.petId },
        });
        if (!petDef) {
          throw new NotFoundException('Pet definition not found');
        }
        dto.basePetId = petDef.id;
        delete dto.petId;
      }

      // Set evolutionDescription from description if provided
      if (dto.description !== undefined) {
        dto.evolutionDescription = dto.description;
        delete dto.description;
      }

      // Ensure required fields are present
      if (!dto.evolutionName && dto.evolutionStage) {
        const evolution = await this.petEvolutionRepository.findOne({
          where: { id },
          relations: ['basePet'],
        });
        if (evolution) {
          dto.evolutionName = `${evolution.basePet?.name || 'Pet'} - Stage ${dto.evolutionStage}`;
        }
      }

      // Set defaults for optional fields
      dto.requiredItems = dto.requiredItems || [];
      dto.newAbilities = dto.newAbilities || null;
      dto.newImages = dto.newImages || [];

      await this.petEvolutionRepository.update(id, dto);
      return this.petEvolutionRepository.findOne({
        where: { id },
      });
    } catch (error) {
      console.error('Update evolution error:', error);
      throw error;
    }
  }

  async deleteEvolution(id: number) {
    const evolution = await this.petEvolutionRepository.findOne({
      where: { id },
    });
    if (!evolution) {
      throw new NotFoundException('Evolution not found');
    }
    await this.petEvolutionRepository.remove(evolution);
    return { success: true, message: 'Evolution deleted successfully' };
  }

  // ==================== PET UPGRADE METHODS ====================

  /**
   * Get upgrade materials required for a pet to reach next level
   */
  async getUpgradeRequirements(
    userPetId: number,
    userId: number,
  ): Promise<{
    level: number;
    materials: Array<{
      itemId: number;
      itemName: string;
      quantity: number;
      playerHas: number;
      hasEnough: boolean;
    }>;
    goldCost: number;
    playerGold: number;
    hasEnoughGold: boolean;
    canUpgrade: boolean;
    statIncrease?: any;
  }> {
    // Get user pet
    const userPet = await this.userPetRepository.findOne({
      where: { id: userPetId, userId },
      relations: ['petDefinition'],
    });

    if (!userPet) {
      throw new NotFoundException('Pet not found');
    }

    // Check if pet is already max level
    if (userPet.level >= userPet.petDefinition.maxLevel) {
      throw new BadRequestException('Pet is already at max level');
    }

    const targetLevel = userPet.level + 1;

    // Get upgrade materials for target level
    const upgradeMaterials = await this.petUpgradeMaterialRepository.find({
      where: {
        petDefinitionId: userPet.petDefinitionId,
        level: targetLevel,
      },
      relations: ['materialItem'],
    });

    if (upgradeMaterials.length === 0) {
      throw new NotFoundException(
        `No upgrade materials defined for level ${targetLevel}`,
      );
    }

    // Get user's gold
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate total gold cost
    const totalGoldCost = upgradeMaterials.reduce(
      (sum, mat) => sum + mat.goldCost,
      0,
    );

    // Check player's materials
    const materialChecks = await Promise.all(
      upgradeMaterials.map(async (mat) => {
        // Handle gold-only upgrades (materialItemId is null)
        if (!mat.materialItemId) {
          return {
            itemId: null,
            itemName: 'Gold only',
            quantity: 0,
            playerHas: 0,
            hasEnough: true,
          };
        }

        const userItem = await this.userItemRepository.findOne({
          where: {
            userId,
            itemId: mat.materialItemId,
          },
          relations: ['item'],
        });

        return {
          itemId: mat.materialItemId,
          itemName: mat.materialItem?.name || 'Unknown Item',
          quantity: mat.quantity,
          playerHas: userItem?.quantity || 0,
          hasEnough: (userItem?.quantity || 0) >= mat.quantity,
        };
      }),
    );

    const canUpgrade =
      materialChecks.every((m) => m.hasEnough) && user.gold >= totalGoldCost;

    // Get stat increase (take from first material, assuming all have same stat increase)
    const statIncrease = upgradeMaterials[0]?.statIncrease || null;

    return {
      level: targetLevel,
      materials: materialChecks,
      goldCost: totalGoldCost,
      playerGold: user.gold,
      hasEnoughGold: user.gold >= totalGoldCost,
      canUpgrade,
      statIncrease,
    };
  }

  /**
   * Upgrade a user's pet to next level
   */
  async upgradePet(
    userPetId: number,
    userId: number,
  ): Promise<{
    success: boolean;
    message: string;
    newLevel: number;
    newStats: any;
  }> {
    // Get upgrade requirements first
    const requirements = await this.getUpgradeRequirements(userPetId, userId);

    if (!requirements.canUpgrade) {
      throw new BadRequestException('Not enough materials or gold to upgrade');
    }

    // Get user pet
    const userPet = await this.userPetRepository.findOne({
      where: { id: userPetId, userId },
      relations: ['petDefinition'],
    });

    if (!userPet) {
      throw new NotFoundException('Pet not found');
    }

    // Get user
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Deduct gold
    if (requirements.goldCost > 0) {
      user.gold -= requirements.goldCost;
      await this.userRepository.save(user);
    }

    // Deduct materials
    for (const material of requirements.materials) {
      const userItem = await this.userItemRepository.findOne({
        where: {
          userId,
          itemId: material.itemId,
        },
      });

      if (userItem) {
        userItem.quantity -= material.quantity;
        if (userItem.quantity <= 0) {
          await this.userItemRepository.remove(userItem);
        } else {
          await this.userItemRepository.save(userItem);
        }
      }
    }

    // Increase pet level
    userPet.level += 1;

    // Update stats
    userPet.updateCurrentStats();
    await this.userPetRepository.save(userPet);

    return {
      success: true,
      message: `Pet upgraded to level ${userPet.level}!`,
      newLevel: userPet.level,
      newStats: userPet.currentStats,
    };
  }

  // ==================== ADMIN: UPGRADE MATERIALS MANAGEMENT ====================

  /**
   * Get all upgrade materials for a pet definition
   */
  async getUpgradeMaterialsForPet(
    petDefinitionId: number,
  ): Promise<PetUpgradeMaterial[]> {
    return this.petUpgradeMaterialRepository.find({
      where: { petDefinitionId },
      relations: ['materialItem'],
      order: { level: 'ASC' },
    });
  }

  /**
   * Create upgrade material requirement
   */
  async createUpgradeMaterial(data: {
    petDefinitionId: number;
    level: number;
    materialItemId?: number | null;
    quantity?: number | null;
    goldCost: number;
    statIncrease?: any;
  }): Promise<PetUpgradeMaterial> {
    // Verify pet definition exists
    const petDef = await this.petDefinitionRepository.findOne({
      where: { id: data.petDefinitionId },
    });
    if (!petDef) {
      throw new NotFoundException('Pet definition not found');
    }

    // CRITICAL: Validate materialItemId and quantity consistency
    const hasMaterialId =
      data.materialItemId !== undefined && data.materialItemId !== null;
    const hasQuantity = data.quantity !== undefined && data.quantity !== null;

    if (hasMaterialId !== hasQuantity) {
      throw new BadRequestException(
        'materialItemId và quantity phải cùng null hoặc cùng có giá trị',
      );
    }

    // Normalize data: ensure both are null if one is missing
    const normalizedData = {
      ...data,
      materialItemId: hasMaterialId ? data.materialItemId : null,
      quantity: hasQuantity ? data.quantity : null,
    };

    // Create upgrade material
    const upgradeMaterial =
      this.petUpgradeMaterialRepository.create(normalizedData);
    return this.petUpgradeMaterialRepository.save(upgradeMaterial);
  }

  /**
   * Update upgrade material
   */
  async updateUpgradeMaterial(
    id: number,
    data: {
      materialItemId?: number | null;
      quantity?: number | null;
      goldCost?: number;
      statIncrease?: any;
    },
  ): Promise<PetUpgradeMaterial> {
    const material = await this.petUpgradeMaterialRepository.findOne({
      where: { id },
    });

    if (!material) {
      throw new NotFoundException('Upgrade material not found');
    }

    // CRITICAL: Check if material fields are being updated
    const isMaterialFieldIncluded =
      'materialItemId' in data || 'quantity' in data;

    if (isMaterialFieldIncluded) {
      // If updating material fields, validate consistency
      const newMaterialId =
        'materialItemId' in data
          ? data.materialItemId
          : material.materialItemId;
      const newQuantity =
        'quantity' in data ? data.quantity : material.quantity;

      const hasMaterialId =
        newMaterialId !== undefined && newMaterialId !== null;
      const hasQuantity = newQuantity !== undefined && newQuantity !== null;

      if (hasMaterialId !== hasQuantity) {
        throw new BadRequestException(
          'materialItemId và quantity phải cùng null hoặc cùng có giá trị',
        );
      }

      // Apply both fields together to maintain consistency
      material.materialItemId = newMaterialId;
      material.quantity = newQuantity;
    }

    // Update other fields
    if ('goldCost' in data) material.goldCost = data.goldCost!;
    if ('statIncrease' in data) material.statIncrease = data.statIncrease;

    // CRITICAL: Use update() instead of save() to properly set null values
    await this.petUpgradeMaterialRepository.update(id, {
      ...(isMaterialFieldIncluded && {
        materialItemId: material.materialItemId,
        quantity: material.quantity,
      }),
      ...('goldCost' in data && { goldCost: material.goldCost }),
      ...('statIncrease' in data && { statIncrease: material.statIncrease }),
    });

    // Return updated entity
    const updated = await this.petUpgradeMaterialRepository.findOne({
      where: { id },
      relations: ['materialItem'],
    });

    if (!updated) {
      throw new NotFoundException('Upgrade material not found after update');
    }

    return updated;
  }

  /**
   * Delete upgrade material
   */
  async deleteUpgradeMaterial(
    id: number,
  ): Promise<{ success: boolean; message: string }> {
    const material = await this.petUpgradeMaterialRepository.findOne({
      where: { id },
    });

    if (!material) {
      throw new NotFoundException('Upgrade material not found');
    }

    await this.petUpgradeMaterialRepository.remove(material);
    return {
      success: true,
      message: 'Upgrade material deleted successfully',
    };
  }
}
