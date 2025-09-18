/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ItemSet } from './item-set.entity';
import { Item } from './item.entity';

@Injectable()
export class ItemSetsService {
  constructor(
    @InjectRepository(ItemSet)
    private itemSetsRepository: Repository<ItemSet>,
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
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
    const saved = await this.itemSetsRepository.save(newItemSet);

    // If items were provided when creating the set, ensure each Item's setId
    // foreign key is updated to point to the new set. This keeps the Item
    // rows consistent (some callers previously only updated the join table
    // which left the Item.setId null).
    if (itemSet.items && itemSet.items.length) {
      const incomingIds = (itemSet.items as Array<{ id?: number } | number>)
        .map((i) =>
          typeof i === 'object' && i !== null ? (i as any).id : (i as number),
        )
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));

      if (incomingIds.length) {
        await this.itemsRepository.update(
          { id: In(incomingIds) },
          { setId: saved.id },
        );
      }
    }

    return saved;
  }

  async update(id: number, itemSet: Partial<ItemSet>): Promise<ItemSet | null> {
    // If items relation is provided, handle relation update explicitly so TypeORM
    // updates the join/foreign keys correctly. repository.update doesn't manage
    // ManyToMany/ManyToOne relation rows reliably.
    if (itemSet.items) {
      const existing = await this.findOne(id);
      if (!existing) return null;

      // If incoming items are simple id objects like { id: 1 }, normalize to ids
      const incomingIds = (itemSet.items as Array<{ id?: number } | number>)
        .map((i) =>
          typeof i === 'object' && i !== null ? (i as any).id : (i as number),
        )
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));

      // Load actual Item entities for the provided ids (ignore missing ids)
      const items = incomingIds.length
        ? await this.itemsRepository.find({ where: { id: In(incomingIds) } })
        : [];

      // Apply other scalar fields if present
      if (typeof itemSet.name !== 'undefined') existing.name = itemSet.name;
      if (typeof itemSet.description !== 'undefined')
        existing.description = itemSet.description;
      if (typeof itemSet.rarity !== 'undefined')
        existing.rarity = itemSet.rarity as number;
      if (typeof itemSet.setBonuses !== 'undefined')
        existing.setBonuses = itemSet.setBonuses as any[];

      const saved = await this.itemSetsRepository.save({ ...existing, items });

      // Update Item.setId for newly attached items

      const existingIds = (existing.items || [])
        .map((i) => i.id)
        .filter(Boolean) as number[];

      const toAttach = incomingIds.filter((i) => !existingIds.includes(i));
      const toDetach = existingIds.filter((i) => !incomingIds.includes(i));

      if (toAttach.length) {
        await this.itemsRepository.update({ id: In(toAttach) }, { setId: id });
      }

      if (toDetach.length) {
        await this.itemsRepository.update(
          { id: In(toDetach) },
          { setId: null },
        );
      }

      return this.findOne(id);
    }

    await this.itemSetsRepository.update(id, itemSet);
    return this.findOne(id);
  }

  async remove(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const itemSet = await this.findOne(id);
      if (!itemSet) {
        return { success: false, message: 'Item set not found' };
      }

      // If items are attached to this set, detach them first so they revert to single items
      // (clear their setId foreign key). This matches the expected UX: deleting a set
      // should not delete individual items.
      if (itemSet.items && itemSet.items.length > 0) {
        const attachedIds = itemSet.items.map((i) => i.id).filter(Boolean);
        if (attachedIds.length) {
          await this.itemsRepository.update(
            { id: In(attachedIds) },
            { setId: null },
          );
        }
      }

      // Now safe to remove the item set record. Join-table rows should be cleaned up
      // by the database / TypeORM when the set row is deleted.
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
