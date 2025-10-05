import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PetAbility } from './entities/pet-ability.entity';
import { AbilityType } from './interfaces/pet-ability.interface';

@Injectable()
export class PetAbilityService {
  constructor(
    @InjectRepository(PetAbility)
    private petAbilityRepository: Repository<PetAbility>,
  ) {}

  async findAll(filters?: {
    type?: AbilityType;
    rarity?: number;
    isActive?: boolean;
  }): Promise<PetAbility[]> {
    const query = this.petAbilityRepository.createQueryBuilder('ability');

    if (filters?.type) {
      query.andWhere('ability.type = :type', { type: filters.type });
    }
    if (filters?.rarity) {
      query.andWhere('ability.rarity = :rarity', { rarity: filters.rarity });
    }
    if (filters?.isActive !== undefined) {
      query.andWhere('ability.isActive = :isActive', {
        isActive: filters.isActive,
      });
    }

    return query
      .orderBy('ability.rarity', 'DESC')
      .addOrderBy('ability.name', 'ASC')
      .getMany();
  }

  async findById(id: number): Promise<PetAbility> {
    const ability = await this.petAbilityRepository.findOne({ where: { id } });
    if (!ability) {
      throw new NotFoundException(`Pet ability with ID ${id} not found`);
    }
    return ability;
  }

  async findByIds(ids: number[]): Promise<PetAbility[]> {
    if (ids.length === 0) return [];
    return this.petAbilityRepository
      .createQueryBuilder('ability')
      .where('ability.id IN (:...ids)', { ids })
      .getMany();
  }

  async create(createDto: Partial<PetAbility>): Promise<PetAbility> {
    const ability = this.petAbilityRepository.create(createDto);
    return this.petAbilityRepository.save(ability);
  }

  async update(
    id: number,
    updateDto: Partial<PetAbility>,
  ): Promise<PetAbility> {
    await this.findById(id);
    await this.petAbilityRepository.update(id, updateDto);
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    const ability = await this.findById(id);
    await this.petAbilityRepository.remove(ability);
  }
}
