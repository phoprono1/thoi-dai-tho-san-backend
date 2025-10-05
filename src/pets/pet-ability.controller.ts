import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { PetAbilityService } from './pet-ability.service';
import { PetAbility } from './entities/pet-ability.entity';
import { AbilityType } from './interfaces/pet-ability.interface';
import { CreatePetAbilityDto } from './dto/create-pet-ability.dto';

@ApiTags('admin/pet-abilities')
@Controller('admin/pet-abilities')
export class PetAbilityController {
  private readonly logger = new Logger(PetAbilityController.name);

  constructor(private petAbilityService: PetAbilityService) {}

  @Get('debug')
  @ApiOperation({ summary: 'Debug endpoint to test service' })
  async debug(): Promise<any> {
    try {
      const result = await this.petAbilityService.findAll();
      return {
        success: true,
        count: result.length,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
        name: error.name,
      };
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all pet abilities with optional filters' })
  @ApiQuery({ name: 'type', required: false, enum: AbilityType })
  @ApiQuery({ name: 'rarity', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async getAll(
    @Query('type') type?: AbilityType,
    @Query('rarity') rarity?: string,
    @Query('isActive') isActive?: string,
  ): Promise<PetAbility[]> {
    const filters: {
      type?: AbilityType;
      rarity?: number;
      isActive?: boolean;
    } = {};

    if (type) filters.type = type;
    if (rarity) filters.rarity = parseInt(rarity);
    if (isActive) filters.isActive = isActive === 'true';

    return this.petAbilityService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pet ability by ID' })
  async getById(@Param('id') id: string): Promise<PetAbility> {
    return this.petAbilityService.findById(parseInt(id));
  }

  @Post()
  @ApiOperation({ summary: 'Create new pet ability' })
  async create(@Body() createDto: CreatePetAbilityDto): Promise<PetAbility> {
    try {
      this.logger.log(
        'Creating pet ability with data:',
        JSON.stringify(createDto, null, 2),
      );

      // Validate that required fields are present
      if (!createDto.type) {
        throw new BadRequestException('Field "type" is required');
      }
      if (!createDto.targetType) {
        throw new BadRequestException('Field "targetType" is required');
      }
      if (!createDto.effects) {
        throw new BadRequestException('Field "effects" is required');
      }

      const result = await this.petAbilityService.create(createDto);
      this.logger.log('Created pet ability successfully:', result.id);
      return result;
    } catch (error) {
      this.logger.error(
        'Error creating pet ability:',
        error.message,
        error.stack,
      );
      throw error;
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update pet ability' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreatePetAbilityDto>,
  ): Promise<PetAbility> {
    try {
      this.logger.log(
        `Updating pet ability ${id} with data:`,
        JSON.stringify(updateDto, null, 2),
      );
      const result = await this.petAbilityService.update(
        parseInt(id),
        updateDto,
      );
      this.logger.log('Updated pet ability successfully:', result.id);
      return result;
    } catch (error) {
      this.logger.error(
        `Error updating pet ability ${id}:`,
        error.message,
        error.stack,
      );
      throw error;
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete pet ability' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.petAbilityService.delete(parseInt(id));
  }
}
