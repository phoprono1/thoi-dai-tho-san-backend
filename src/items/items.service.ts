/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './item.entity';
import { ItemType } from './item-types.enum';
import {
  ClassType,
  ClassTier,
} from '../character-classes/character-class.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
  ) {}

  findAll(): Promise<Item[]> {
    return this.itemsRepository.find({
      relations: ['itemSet', 'itemSet.items'],
      order: { createdAt: 'DESC' },
    });
  }

  findOne(id: number): Promise<Item | null> {
    return this.itemsRepository.findOne({
      where: { id },
      relations: ['itemSet', 'itemSet.items'],
    });
  }

  async findByClass(classId: number): Promise<Item[]> {
    return this.itemsRepository.find({
      where: { id: 0 }, // This will be replaced with proper logic
      relations: ['itemSet', 'itemSet.items'],
    });
  }

  async findByClassType(
    classType: ClassType,
    minTier?: ClassTier,
  ): Promise<Item[]> {
    // For now, return all items - we'll implement proper filtering later
    return this.itemsRepository.find({
      relations: ['itemSet', 'itemSet.items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findBySet(setId: number): Promise<Item[]> {
    return this.itemsRepository.find({
      where: { setId },
      relations: ['itemSet', 'itemSet.items'],
    });
  }

  async findByType(type: string): Promise<Item[]> {
    return this.itemsRepository.find({
      where: { type: type as ItemType },
      relations: ['itemSet', 'itemSet.items'],
      order: { rarity: 'DESC', createdAt: 'DESC' },
    });
  }

  async create(item: Partial<Item>): Promise<Item> {
    const newItem = this.itemsRepository.create(item);
    return this.itemsRepository.save(newItem);
  }

  async update(id: number, item: Partial<Item>): Promise<Item | null> {
    const existingItem = await this.findOne(id);
    if (!existingItem) {
      return null;
    }

    // Handle stats separately since they're stored in JSONB
    const updateData: Partial<Item> = {};

    // Copy only valid entity properties (exclude individual stat properties)
    if (item.name !== undefined) updateData.name = item.name;
    if (item.type !== undefined) updateData.type = item.type;
    if (item.rarity !== undefined) updateData.rarity = item.rarity;

    // Handle optional properties with proper type checking
    if ('price' in item && typeof item.price === 'number') {
      updateData.price = item.price;
    }
    if ('setId' in item && typeof item.setId === 'number') {
      updateData.setId = item.setId;
    }

    if ('consumableType' in item && typeof item.consumableType === 'string') {
      updateData.consumableType = item.consumableType;
    }

    if ('consumableValue' in item && typeof item.consumableValue === 'number') {
      updateData.consumableValue = item.consumableValue;
    }

    if ('duration' in item && typeof item.duration === 'number') {
      updateData.duration = item.duration;
    }

    // Allow updating tradable flag explicitly
    if ('tradable' in item && typeof item.tradable === 'boolean') {
      updateData.tradable = item.tradable;
    }

    // Allow updating the image path (string or explicit null to clear)
    if (
      'image' in item &&
      (typeof item.image === 'string' || item.image === null)
    ) {
      updateData.image = item.image as unknown as string | null;
    }

    // Handle class restrictions
    if (item.classRestrictions) {
      updateData.classRestrictions = item.classRestrictions;
    }

    // If stats are being updated, merge them with existing stats
    if (item.stats) {
      updateData.stats = {
        ...existingItem.stats,
        ...item.stats,
      };
    }

    // Remove stats from the update data if it's empty to avoid overwriting
    if (updateData.stats && Object.keys(updateData.stats).length === 0) {
      delete updateData.stats;
    }

    await this.itemsRepository.update(id, updateData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<{ success: boolean; message: string }> {
    // Check if item is being used by any users
    const userItemsCount = await this.itemsRepository
      .createQueryBuilder('item')
      .leftJoin('user_item', 'ui', 'ui.itemId = item.id')
      .where('item.id = :id', { id })
      .andWhere('ui.id IS NOT NULL')
      .getCount();

    if (userItemsCount > 0) {
      return {
        success: false,
        message: `Cannot delete item: it is currently owned by ${userItemsCount} user(s). Remove all user ownership before deleting.`,
      };
    }

    const result = await this.itemsRepository.delete(id);
    if (result.affected && result.affected > 0) {
      return {
        success: true,
        message: 'Item deleted successfully',
      };
    } else {
      return {
        success: false,
        message: 'Item not found',
      };
    }
  }
}
