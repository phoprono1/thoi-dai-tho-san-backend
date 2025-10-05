import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PetService } from './pet.service';
import { PetGachaService } from './pet-gacha.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PetEquipment } from './pet-equipment.entity';
import { PetDefinition } from './pet-definition.entity';
import { PetBanner } from './pet-banner.entity';
import { CreateUpgradeMaterialDto } from './dto/pet-upgrade.dto';

export interface CreatePetDefinitionDto {
  petId: string;
  name: string;
  description: string;
  rarity: number;
  element: string;
  baseStats: {
    strength: number;
    intelligence: number;
    dexterity: number;
    vitality: number;
    luck: number;
  };
  images: string[];
  maxLevel: number;
  maxEvolutionStage: number;
  isActive: boolean;
  sortOrder: number;
}

export interface CreateBannerDto {
  name: string;
  description: string;
  bannerType: 'standard' | 'featured' | 'limited' | 'event';
  costPerPull: number;
  guaranteedRarity: number;
  guaranteedPullCount: number;
  featuredPets: Array<{
    petId: string;
    rateUpMultiplier: number;
  }>;
  dropRates: {
    rarity1: number;
    rarity2: number;
    rarity3: number;
    rarity4: number;
    rarity5: number;
  };
  startDate: string;
  endDate: string;
  bannerImage?: string;
  isActive?: boolean;
  sortOrder: number;
}

@Controller('admin/pets')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminPetController {
  constructor(
    private petService: PetService,
    private petGachaService: PetGachaService,
    @InjectRepository(PetEquipment)
    private petEquipmentRepository: Repository<PetEquipment>,
    @InjectRepository(PetDefinition)
    private petDefinitionRepository: Repository<PetDefinition>,
    @InjectRepository(PetBanner)
    private petBannerRepository: Repository<PetBanner>,
  ) {}

  // Pet Definition Management
  @Get('definitions')
  async getAllPetDefinitions(
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.petService.getAllPetDefinitions(includeInactive === 'true');
  }

  @Get('definitions/:id')
  async getPetDefinition(@Param('id', ParseIntPipe) id: number) {
    return this.petService.getPetDefinitionById(id);
  }

  @Post('definitions')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createPetDefinition(@Body() dto: CreatePetDefinitionDto) {
    try {
      const petDefinition = this.petDefinitionRepository.create({
        petId: dto.petId,
        name: dto.name,
        description: dto.description,
        rarity: dto.rarity,
        element: dto.element as any,
        baseStats: dto.baseStats,
        images: dto.images || [],
        maxLevel: dto.maxLevel,
        maxEvolutionStage: dto.maxEvolutionStage,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      });
      return await this.petDefinitionRepository.save(petDefinition);
    } catch (error) {
      console.error('Error creating pet definition:', error);
      throw new BadRequestException('Failed to create pet definition');
    }
  }

  @Put('definitions/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updatePetDefinition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreatePetDefinitionDto>,
  ) {
    try {
      await this.petDefinitionRepository.update(id, {
        petId: dto.petId,
        name: dto.name,
        description: dto.description,
        rarity: dto.rarity,
        element: dto.element as any,
        baseStats: dto.baseStats,
        images: dto.images,
        maxLevel: dto.maxLevel,
        maxEvolutionStage: dto.maxEvolutionStage,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      });
      return await this.petDefinitionRepository.findOne({ where: { id } });
    } catch (error) {
      console.error('Error updating pet definition:', error);
      throw new BadRequestException('Failed to update pet definition');
    }
  }

  @Delete('definitions/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deletePetDefinition(@Param('id', ParseIntPipe) id: number) {
    try {
      const result = await this.petDefinitionRepository.delete(id);
      return { success: result.affected > 0 };
    } catch (error) {
      console.error('Error deleting pet definition:', error);
      throw new BadRequestException('Failed to delete pet definition');
    }
  }

  // Banner Management
  @Get('banners')
  async getAllBanners() {
    // Admin should see ALL banners (including inactive and scheduled)
    return this.petBannerRepository.find({
      order: {
        sortOrder: 'ASC',
        createdAt: 'DESC',
      },
    });
  }

  @Get('banners/:id')
  async getBanner(@Param('id', ParseIntPipe) id: number) {
    return this.petGachaService.getBannerById(id);
  }

  @Post('banners')
  async createBanner(@Body() dto: CreateBannerDto) {
    try {
      const banner = this.petBannerRepository.create({
        name: dto.name,
        description: dto.description,
        bannerType: dto.bannerType,
        costPerPull: dto.costPerPull,
        guaranteedRarity: dto.guaranteedRarity,
        guaranteedPullCount: dto.guaranteedPullCount,
        featuredPets: dto.featuredPets,
        dropRates: dto.dropRates,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        bannerImage: dto.bannerImage || null,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      });
      return await this.petBannerRepository.save(banner);
    } catch (error) {
      console.error('Error creating banner:', error);
      throw new BadRequestException('Failed to create banner');
    }
  }

  @Put('banners/:id')
  async updateBanner(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateBannerDto>,
  ) {
    try {
      const updateData: any = {};

      if (dto.name) updateData.name = dto.name;
      if (dto.description) updateData.description = dto.description;
      if (dto.bannerType) updateData.bannerType = dto.bannerType;
      if (dto.costPerPull) updateData.costPerPull = dto.costPerPull;
      if (dto.guaranteedRarity)
        updateData.guaranteedRarity = dto.guaranteedRarity;
      if (dto.guaranteedPullCount)
        updateData.guaranteedPullCount = dto.guaranteedPullCount;
      if (dto.featuredPets) updateData.featuredPets = dto.featuredPets;
      if (dto.dropRates) updateData.dropRates = dto.dropRates;
      if (dto.startDate) updateData.startDate = new Date(dto.startDate);
      if (dto.endDate) updateData.endDate = new Date(dto.endDate);
      if (dto.bannerImage !== undefined)
        updateData.bannerImage = dto.bannerImage;
      if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

      await this.petBannerRepository.update(id, updateData);
      return await this.petBannerRepository.findOne({ where: { id } });
    } catch (error) {
      console.error('Error updating banner:', error);
      throw new BadRequestException('Failed to update banner');
    }
  }

  @Delete('banners/:id')
  async deleteBanner(@Param('id', ParseIntPipe) id: number) {
    try {
      const result = await this.petBannerRepository.delete(id);
      return { success: result.affected > 0 };
    } catch (error) {
      console.error('Error deleting banner:', error);
      throw new BadRequestException('Failed to delete banner');
    }
  }

  // Banner Statistics
  // TODO: Re-enable after fixing getBannerStats service method
  /*
  @Get('banners/:id/stats')
  async getBannerStats(@Param('id', ParseIntPipe) id: number) {
    return this.petGachaService.getBannerStats(id);
  }
  */

  // User Management
  @Get('users/:userId/pets')
  async getUserPets(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.petService.getUserPets(userId, includeInactive === 'true');
  }

  @Post('users/:userId/pets')
  async giveUserPet(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { petDefinitionId: number },
  ) {
    return this.petService.createUserPet(userId, body.petDefinitionId);
  }

  @Delete('users/:userId/pets/:petId')
  async removeUserPet(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('petId', ParseIntPipe) petId: number,
  ) {
    await this.petService.releasePet(petId, userId);
    return { message: 'Pet removed successfully' };
  }

  // TODO: Re-enable after fixing getUserGachaStats service method
  /*
  @Get('users/:userId/gacha-stats')
  async getUserGachaStats(@Param('userId', ParseIntPipe) userId: number) {
    return this.petGachaService.getUserGachaStats(userId);
  }
  */

  @Get('users/:userId/pull-history')
  async getUserPullHistory(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('bannerId') bannerId?: string,
    @Query('limit') limit?: string,
  ) {
    const bannerIdNum = bannerId ? parseInt(bannerId) : undefined;
    const limitNum = limit ? parseInt(limit) : 50;
    return this.petGachaService.getUserPullHistory(
      userId,
      bannerIdNum,
      limitNum,
    );
  }

  // Debug endpoint to check database schema
  @Get('debug-schema')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async debugSchema() {
    try {
      // Check what columns exist in pet_equipment table
      const queryRunner =
        this.petEquipmentRepository.manager.connection.createQueryRunner();

      // Get table schema
      const tableInfo: any = await queryRunner.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'pet_equipment'
        ORDER BY ordinal_position
      `);

      // Try to get sample data if any exists
      let sampleData: any = null;
      try {
        const rawQuery: any = await queryRunner.query(
          'SELECT * FROM pet_equipment LIMIT 1',
        );
        sampleData = rawQuery[0] || null;
      } catch (err: any) {
        sampleData = {
          error: 'No data or query failed',
          message: err.message,
        };
      }

      // Get all pet table schemas
      const allPetTables: any = await queryRunner.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name LIKE 'pet_%' 
        ORDER BY table_name
      `);

      await queryRunner.release();

      return {
        petEquipmentSchema: tableInfo,
        sampleData,
        allPetTables: allPetTables.map((t: any) => t.table_name),
        entityFields: {
          expected: [
            'id',
            'name',
            'slot',
            'rarity',
            'statBoosts',
            'setBonus',
            'compatibleElements',
            'image',
            'createdAt',
            'updatedAt',
          ],
          note: 'These are the fields defined in PetEquipment entity',
        },
      };
    } catch (error: any) {
      console.error('Error debugging schema:', error);
      return {
        error: 'Failed to debug schema',
        message: error.message,
        stack: error.stack,
      };
    }
  }

  // Equipment endpoints
  @Get('equipment')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getEquipment(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    try {
      const equipment = await this.petEquipmentRepository.find({
        skip: (page - 1) * limit,
        take: limit,
      });

      const total = await this.petEquipmentRepository.count();

      return {
        data: equipment,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error getting equipment:', error);
      throw new BadRequestException('Failed to get equipment');
    }
  }

  @Post('equipment')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createPetEquipment(@Body() equipmentData: Partial<PetEquipment>) {
    const equipment = this.petEquipmentRepository.create(equipmentData);
    return this.petEquipmentRepository.save(equipment);
  }

  @Get('equipment/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getPetEquipmentById(@Param('id', ParseIntPipe) id: number) {
    const equipment = await this.petEquipmentRepository.findOne({
      where: { id },
    });
    if (!equipment) {
      throw new BadRequestException('Equipment not found');
    }
    return equipment;
  }

  @Put('equipment/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updatePetEquipment(
    @Param('id', ParseIntPipe) id: number,
    @Body() equipmentData: Partial<PetEquipment>,
  ) {
    await this.petEquipmentRepository.update(id, equipmentData);
    return this.petEquipmentRepository.findOne({ where: { id } });
  }

  @Delete('equipment/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deletePetEquipment(@Param('id', ParseIntPipe) id: number) {
    const result = await this.petEquipmentRepository.delete(id);
    return { success: result.affected > 0 };
  }

  // System Statistics
  @Get('stats/overview')
  async getSystemStats() {
    // TODO: Implement system-wide pet statistics
    return {
      message: 'System stats not implemented yet',
    };
  }

  @Get('stats/popular-pets')
  async getPopularPets(@Query('limit') limit?: string) {
    // TODO: Get most obtained pets
    const limitNum = limit ? parseInt(limit) : 10;
    return {
      message: 'Popular pets stats not implemented yet',
      limit: limitNum,
    };
  }

  // Testing/Debug Endpoints
  @Post('test/give-pet')
  async testGivePet(@Body() body: { userId: number; petDefinitionId: number }) {
    return this.petService.createUserPet(body.userId, body.petDefinitionId);
  }

  @Post('test/add-experience')
  async testAddExperience(
    @Body() body: { userId: number; petId: number; amount: number },
  ) {
    return this.petService.addExperience(body.petId, body.userId, body.amount);
  }

  @Post('test/simulate-pulls')
  async testSimulatePulls(
    @Body() body: { userId: number; bannerId: number; count: number },
  ) {
    const results = [];
    for (let i = 0; i < body.count; i++) {
      try {
        const result = await this.petGachaService.performSinglePull(
          body.userId,
          body.bannerId,
        );
        results.push(result);
      } catch (error) {
        results.push({ error: error.message });
        break;
      }
    }
    return {
      totalPulls: results.length,
      results,
    };
  }

  @Delete(':id/images/:index')
  async deletePetImage(@Param('id') id: number, @Param('index') index: number) {
    try {
      await this.petService.removePetImage(id, index);
      return { success: true, message: 'Image removed successfully' };
    } catch (error) {
      throw new BadRequestException('Failed to remove image');
    }
  }

  // Pet Evolution Management
  @Get(':petId/evolutions')
  async getPetEvolutions(@Param('petId') petId: string) {
    return this.petService.getEvolutionsForPet(petId);
  }

  @Post('evolutions')
  async createPetEvolution(@Body() dto: any) {
    return this.petService.createEvolution(dto);
  }

  @Put('evolutions/:id')
  async updatePetEvolution(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
  ) {
    return this.petService.updateEvolution(id, dto);
  }

  @Delete('evolutions/:id')
  async deletePetEvolution(@Param('id', ParseIntPipe) id: number) {
    return this.petService.deleteEvolution(id);
  }

  // ==================== PET UPGRADE MATERIALS (ADMIN) ====================

  /**
   * Get all upgrade materials for a pet definition
   */
  @Get('pets/:petId/upgrade-materials')
  async getUpgradeMaterials(@Param('petId', ParseIntPipe) petId: number) {
    return this.petService.getUpgradeMaterialsForPet(petId);
  }

  /**
   * Create upgrade material requirement
   */
  @Post('upgrade-materials')
  async createUpgradeMaterial(@Body() dto: CreateUpgradeMaterialDto) {
    // Validation: materialItemId and quantity must be both null or both have values
    const hasMaterialId =
      dto.materialItemId !== undefined && dto.materialItemId !== null;
    const hasQuantity = dto.quantity !== undefined && dto.quantity !== null;

    if (hasMaterialId !== hasQuantity) {
      throw new BadRequestException(
        'materialItemId và quantity phải cùng null hoặc cùng có giá trị',
      );
    }

    return this.petService.createUpgradeMaterial(dto);
  }

  /**
   * Update upgrade material
   */
  @Put('upgrade-materials/:id')
  async updateUpgradeMaterial(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateUpgradeMaterialDto,
  ) {
    // Validation: materialItemId and quantity must be both null or both have values
    const hasMaterialId =
      dto.materialItemId !== undefined && dto.materialItemId !== null;
    const hasQuantity = dto.quantity !== undefined && dto.quantity !== null;

    if (hasMaterialId !== hasQuantity) {
      throw new BadRequestException(
        'materialItemId và quantity phải cùng null hoặc cùng có giá trị',
      );
    }

    return this.petService.updateUpgradeMaterial(id, dto);
  }

  /**
   * Delete upgrade material
   */
  @Delete('upgrade-materials/:id')
  async deleteUpgradeMaterial(@Param('id', ParseIntPipe) id: number) {
    return this.petService.deleteUpgradeMaterial(id);
  }
}
