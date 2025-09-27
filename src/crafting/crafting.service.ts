import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CraftingRecipe, CraftingMaterial } from './crafting-recipe.entity';
import { Item } from '../items/item.entity';
import { UserItem } from '../user-items/user-item.entity';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import { ConsumableType } from '../items/item-types.enum';

export interface CreateCraftingRecipeDto {
  name: string;
  description?: string;
  resultItemId: number;
  resultQuantity: number;
  materials: CraftingMaterial[];
  craftingLevel: number;
  goldCost: number;
  craftingTime: number;
  category: number;
}

export interface CraftItemDto {
  recipeId: number;
  quantity?: number; // Số lần craft (mặc định 1)
}

export interface CraftingResult {
  success: boolean;
  message: string;
  craftedItems?: {
    itemId: number;
    itemName: string;
    quantity: number;
  }[];
  consumedMaterials?: {
    itemId: number;
    itemName: string;
    quantity: number;
  }[];
}

@Injectable()
export class CraftingService {
  constructor(
    @InjectRepository(CraftingRecipe)
    private craftingRecipeRepository: Repository<CraftingRecipe>,
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    @InjectRepository(UserItem)
    private userItemRepository: Repository<UserItem>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserStat)
    private userStatRepository: Repository<UserStat>,
  ) {}

  // Admin methods
  async getAllRecipes(): Promise<CraftingRecipe[]> {
    return this.craftingRecipeRepository.find({
      relations: ['resultItem'],
      order: { category: 'ASC', craftingLevel: 'ASC' },
    });
  }

  async getRecipeById(id: number): Promise<CraftingRecipe> {
    const recipe = await this.craftingRecipeRepository.findOne({
      where: { id },
      relations: ['resultItem'],
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    return recipe;
  }

  async createRecipe(dto: CreateCraftingRecipeDto): Promise<CraftingRecipe> {
    // Validate result item exists
    const resultItem = await this.itemRepository.findOne({
      where: { id: dto.resultItemId },
    });

    if (!resultItem) {
      throw new NotFoundException('Result item not found');
    }

    // Validate material items exist
    for (const material of dto.materials) {
      const item = await this.itemRepository.findOne({
        where: { id: material.itemId },
      });
      if (!item) {
        throw new NotFoundException(
          `Material item ${material.itemId} not found`,
        );
      }
    }

    const recipe = this.craftingRecipeRepository.create(dto);
    return this.craftingRecipeRepository.save(recipe);
  }

  async updateRecipe(
    id: number,
    dto: Partial<CreateCraftingRecipeDto>,
  ): Promise<CraftingRecipe> {
    const recipe = await this.getRecipeById(id);

    Object.assign(recipe, dto);
    return this.craftingRecipeRepository.save(recipe);
  }

  async deleteRecipe(id: number): Promise<void> {
    const recipe = await this.getRecipeById(id);
    await this.craftingRecipeRepository.remove(recipe);
  }

  // Player methods
  async getAvailableRecipes(userId: number): Promise<CraftingRecipe[]> {
    // TODO: Filter by player's crafting level when we implement crafting levels
    return this.craftingRecipeRepository.find({
      where: { isActive: true },
      relations: ['resultItem'],
      order: { category: 'ASC', craftingLevel: 'ASC' },
    });
  }

  async craftItem(userId: number, dto: CraftItemDto): Promise<CraftingResult> {
    const recipe = await this.getRecipeById(dto.recipeId);
    const quantity = dto.quantity || 1;

    if (!recipe.isActive) {
      throw new BadRequestException('Recipe is not active');
    }

    // Get user
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check gold cost
    const totalGoldCost = recipe.goldCost * quantity;
    if (user.gold < totalGoldCost) {
      return {
        success: false,
        message: `Không đủ vàng! Cần ${totalGoldCost.toLocaleString()}, có ${user.gold.toLocaleString()}`,
      };
    }

    // Check materials
    const materialCheck = await this.checkMaterials(
      userId,
      recipe.materials,
      quantity,
    );
    if (!materialCheck.success) {
      return materialCheck;
    }

    // Consume materials
    await this.consumeMaterials(userId, recipe.materials, quantity);

    // Deduct gold
    user.gold -= totalGoldCost;
    await this.userRepository.save(user);

    // Create result items
    const resultQuantity = recipe.resultQuantity * quantity;
    await this.addItemToUser(userId, recipe.resultItemId, resultQuantity);

    // Handle special consumables (permanent stat boosts)
    if (
      recipe.resultItem.consumableType === ConsumableType.PERMANENT_STAT_BOOST
    ) {
      await this.applyPermanentStatBoost(
        userId,
        recipe.resultItem,
        resultQuantity,
      );
    }

    return {
      success: true,
      message: `Chế tạo thành công ${resultQuantity}x ${recipe.resultItem.name}!`,
      craftedItems: [
        {
          itemId: recipe.resultItemId,
          itemName: recipe.resultItem.name,
          quantity: resultQuantity,
        },
      ],
      consumedMaterials: recipe.materials.map((m) => ({
        itemId: m.itemId,
        itemName: 'Material', // TODO: Get actual item name
        quantity: m.quantity * quantity,
      })),
    };
  }

  private async checkMaterials(
    userId: number,
    materials: CraftingMaterial[],
    craftQuantity: number,
  ): Promise<CraftingResult> {
    for (const material of materials) {
      const requiredQuantity = material.quantity * craftQuantity;
      const userItem = await this.userItemRepository.findOne({
        where: { userId, itemId: material.itemId },
        relations: ['item'],
      });

      if (!userItem || userItem.quantity < requiredQuantity) {
        const currentQuantity = userItem?.quantity || 0;
        return {
          success: false,
          message: `Không đủ nguyên liệu ${userItem?.item?.name || `Item ${material.itemId}`}! Cần ${requiredQuantity}, có ${currentQuantity}`,
        };
      }
    }

    return { success: true, message: 'Materials available' };
  }

  private async consumeMaterials(
    userId: number,
    materials: CraftingMaterial[],
    craftQuantity: number,
  ): Promise<void> {
    for (const material of materials) {
      const requiredQuantity = material.quantity * craftQuantity;
      const userItem = await this.userItemRepository.findOne({
        where: { userId, itemId: material.itemId },
      });

      if (userItem) {
        userItem.quantity -= requiredQuantity;
        if (userItem.quantity <= 0) {
          await this.userItemRepository.remove(userItem);
        } else {
          await this.userItemRepository.save(userItem);
        }
      }
    }
  }

  private async addItemToUser(
    userId: number,
    itemId: number,
    quantity: number,
  ): Promise<void> {
    let userItem = await this.userItemRepository.findOne({
      where: { userId, itemId },
    });

    if (userItem) {
      userItem.quantity += quantity;
      await this.userItemRepository.save(userItem);
    } else {
      userItem = this.userItemRepository.create({
        userId,
        itemId,
        quantity,
      });
      await this.userItemRepository.save(userItem);
    }
  }

  private async applyPermanentStatBoost(
    userId: number,
    item: Item,
    quantity: number,
  ): Promise<void> {
    if (!item.stats) return;

    const userStat = await this.userStatRepository.findOne({
      where: { userId },
    });

    if (userStat && item.stats) {
      // Apply permanent stat increases
      if (item.stats.strength) {
        userStat.strength += item.stats.strength * quantity;
      }
      if (item.stats.intelligence) {
        userStat.intelligence += item.stats.intelligence * quantity;
      }
      if (item.stats.dexterity) {
        userStat.dexterity += item.stats.dexterity * quantity;
      }
      if (item.stats.vitality) {
        userStat.vitality += item.stats.vitality * quantity;
      }
      if (item.stats.luck) {
        userStat.luck += item.stats.luck * quantity;
      }

      await this.userStatRepository.save(userStat);
    }
  }

  // Get recipes by category
  async getRecipesByCategory(category: number): Promise<CraftingRecipe[]> {
    return this.craftingRecipeRepository.find({
      where: { category, isActive: true },
      relations: ['resultItem'],
      order: { craftingLevel: 'ASC' },
    });
  }
}
