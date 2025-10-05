import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../users/user.entity';
import { PetService } from './pet.service';
import { PetGachaService } from './pet-gacha.service';

@Controller('pets')
@UseGuards(JwtAuthGuard)
export class PetController {
  constructor(
    private petService: PetService,
    private petGachaService: PetGachaService,
  ) {}

  // Pet Definitions
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

  // User Pets
  @Get('my-pets')
  async getMyPets(
    @CurrentUser() user: User,
    @Query('includeInactive') includeInactive?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.petService.getUserPets(
      user.id,
      includeInactive === 'true',
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Get('my-pets/:petId')
  async getMyPet(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
  ) {
    return this.petService.getUserPetWithDetails(petId, user.id);
  }

  @Get('active-pet')
  async getActivePet(@CurrentUser() user: User) {
    return this.petService.getActivePet(user.id);
  }

  @Put('active-pet/:petId')
  async setActivePet(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
  ) {
    return this.petService.setActivePet(user.id, petId);
  }

  // Pet Experience & Friendship
  @Post('my-pets/:petId/experience')
  async addExperience(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
    @Body() body: { amount: number },
  ) {
    return this.petService.addExperience(petId, user.id, body.amount);
  }

  @Post('my-pets/:petId/friendship')
  async addFriendship(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
    @Body() body: { amount: number },
  ) {
    return this.petService.addFriendship(petId, user.id, body.amount);
  }

  // Pet Evolution
  @Get('my-pets/:petId/evolutions')
  async getAvailableEvolutions(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
  ) {
    return this.petService.getAvailableEvolutions(petId, user.id);
  }

  @Post('my-pets/:petId/evolve')
  async evolvePet(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
    @Body() body: { evolutionId: number; sacrificePetIds?: number[] },
  ) {
    return this.petService.evolvePet(
      petId,
      user.id,
      body.evolutionId,
      body.sacrificePetIds,
    );
  }

  @Get('my-pets/:petId/can-evolve/:evolutionId')
  async canEvolvePet(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
    @Param('evolutionId', ParseIntPipe) evolutionId: number,
  ) {
    return this.petService.canEvolvePet(petId, user.id, evolutionId);
  }

  @Patch('my-pets/:petId/skin')
  async changeSkin(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
    @Body() body: { skinIndex: number },
  ) {
    return this.petService.changeSkin(petId, user.id, body.skinIndex);
  }

  // Pet Equipment
  @Get('my-pets/:petId/equipment')
  async getEquippedItems(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
  ): Promise<Record<string, any>> {
    return this.petService.getEquippedItems(petId, user.id);
  }

  @Post('my-pets/:petId/equip')
  async equipItem(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
    @Body() body: { itemId: number; slot: string },
  ) {
    return this.petService.equipItem(petId, user.id, body.itemId, body.slot);
  }

  @Delete('my-pets/:petId/unequip/:slot')
  async unequipItem(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
    @Param('slot') slot: string,
  ) {
    return this.petService.unequipItem(petId, user.id, slot);
  }

  // Pet Management
  @Delete('my-pets/:petId/release')
  async releasePet(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
  ) {
    await this.petService.releasePet(petId, user.id);
    return { message: 'Pet released successfully' };
  }

  // Statistics
  @Get('my-stats')
  async getMyPetStats(@CurrentUser() user: User) {
    return this.petService.getUserPetStats(user.id);
  }

  // Gacha System
  @Get('banners/active')
  async getActiveBanners() {
    return this.petGachaService.getActiveBanners();
  }

  @Get('banners/:bannerId')
  async getBanner(@Param('bannerId', ParseIntPipe) bannerId: number) {
    return this.petGachaService.getBannerById(bannerId);
  }

  @Get('banners/:bannerId/featured-pets')
  async getFeaturedPets(@Param('bannerId', ParseIntPipe) bannerId: number) {
    return this.petGachaService.getFeaturedPetsForBanner(bannerId);
  }

  @Get('banners/:bannerId/pity')
  async getBannerPity(
    @CurrentUser() user: User,
    @Param('bannerId', ParseIntPipe) bannerId: number,
  ) {
    return this.petGachaService.getUserPity(user.id, bannerId);
  }

  @Post('banners/:bannerId/pull')
  async singlePull(
    @CurrentUser() user: User,
    @Param('bannerId', ParseIntPipe) bannerId: number,
  ) {
    return this.petGachaService.performSinglePull(user.id, bannerId);
  }

  @Post('banners/:bannerId/pull-10')
  async multiPull(
    @CurrentUser() user: User,
    @Param('bannerId', ParseIntPipe) bannerId: number,
  ) {
    return this.petGachaService.performMultiPull(user.id, bannerId);
  }

  @Get('pull-history')
  async getPullHistory(
    @CurrentUser() user: User,
    @Query('bannerId') bannerId?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const bannerIdNum = bannerId ? parseInt(bannerId) : undefined;
      const limitNum = limit ? parseInt(limit) : 50;
      return this.petGachaService.getUserPullHistory(
        user.id,
        bannerIdNum,
        limitNum,
      );
    } catch (error) {
      console.error('Error in getPullHistory:', error);
      throw error;
    }
  }

  // TODO: Re-enable after fixing getUserGachaStats service method
  /*
  @Get('gacha-stats')
  async getGachaStats(@CurrentUser() user: User) {
    return this.petGachaService.getUserGachaStats(user.id);
  }
  */

  // ==================== PET UPGRADE ENDPOINTS ====================

  /**
   * Get upgrade requirements for next level
   */
  @Get(':petId/upgrade-requirements')
  async getUpgradeRequirements(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
  ) {
    return this.petService.getUpgradeRequirements(petId, user.id);
  }

  /**
   * Upgrade pet to next level
   */
  @Post(':petId/upgrade')
  async upgradePet(
    @CurrentUser() user: User,
    @Param('petId', ParseIntPipe) petId: number,
  ) {
    return this.petService.upgradePet(petId, user.id);
  }
}
