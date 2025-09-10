/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemSet } from './item-set.entity';

@Injectable()
export class ItemSetsService {
  constructor(
    @InjectRepository(ItemSet)
    private itemSetsRepository: Repository<ItemSet>,
  ) {}

  async findAll(): Promise<ItemSet[]> {
    return this.itemSetsRepository.find({
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<ItemSet | null> {
    return this.itemSetsRepository.findOne({
      where: { id },
      relations: ['items'],
    });
  }

  async create(itemSet: Partial<ItemSet>): Promise<ItemSet> {
    const newItemSet = this.itemSetsRepository.create(itemSet);
    return this.itemSetsRepository.save(newItemSet);
  }

  async update(id: number, itemSet: Partial<ItemSet>): Promise<ItemSet | null> {
    await this.itemSetsRepository.update(id, itemSet);
    return this.findOne(id);
  }

  async remove(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const itemSet = await this.findOne(id);
      if (!itemSet) {
        return { success: false, message: 'Item set not found' };
      }

      // Check if any items in the set are being used
      if (itemSet.items && itemSet.items.length > 0) {
        return {
          success: false,
          message: 'Cannot delete item set with items. Remove items first.',
        };
      }

      await this.itemSetsRepository.delete(id);
      return { success: true, message: 'Item set deleted successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to delete item set' };
    }
  }

  async findByRarity(rarity: number): Promise<ItemSet[]> {
    return this.itemSetsRepository.find({
      where: { rarity },
      relations: ['items'],
    });
  }
}
