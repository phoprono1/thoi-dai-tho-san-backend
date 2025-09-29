import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CharacterClassAdvancement } from './character-class-advancement.entity';
import { CharacterClassService } from './character-class.service';
import { CreateMappingDto, UpdateMappingDto } from './character-class.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('admin/character-class-mappings/:fromClassId')
export class MappingsController {
  constructor(
    private readonly characterClassService: CharacterClassService,
    @InjectRepository(CharacterClassAdvancement)
    private readonly mappingRepo: Repository<CharacterClassAdvancement>,
  ) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  async list(@Param('fromClassId', ParseIntPipe) fromClassId: number) {
    return this.mappingRepo.find({ where: { fromClassId } });
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async create(
    @Param('fromClassId', ParseIntPipe) fromClassId: number,
    @Body() dto: CreateMappingDto,
  ) {
    const mapping = this.mappingRepo.create({ fromClassId, ...dto });
    return this.mappingRepo.save(mapping);
  }

  // Bulk normalize mappings (expects body: { mappings: [{ id, weight, ... }] })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('normalize')
  async normalize(
    @Param('fromClassId', ParseIntPipe) fromClassId: number,
    @Body() body: { mappings?: Array<{ id: number; weight?: number }> },
  ) {
    const items = body?.mappings || [];
    const results: Array<any> = [];
    for (const item of items) {
      try {
        const mapping = await this.mappingRepo.findOne({
          where: { id: item.id, fromClassId },
        });
        if (!mapping) continue;
        mapping.weight = Math.max(0, Number(item.weight ?? 0));
        const saved = await this.mappingRepo.save(mapping);
        results.push(saved);
      } catch (e) {
        // continue on error per-item
        console.warn('Failed to normalize mapping', item, e);
      }
    }
    return { success: true, updated: results.length, results };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(':id')
  async update(
    @Param('fromClassId', ParseIntPipe) fromClassId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMappingDto,
  ) {
    console.log('Update mapping request:', {
      fromClassId,
      id,
      dto: JSON.stringify(dto, null, 2),
    });

    const mapping = await this.mappingRepo.findOne({
      where: { id, fromClassId },
    });
    if (!mapping) throw new Error('Mapping not found');

    console.log(
      'Current mapping before update:',
      JSON.stringify(mapping, null, 2),
    );

    Object.assign(mapping, dto);

    // Force TypeORM to detect JSONB changes
    if (dto.requirements) {
      mapping.requirements = { ...dto.requirements };
    }

    console.log(
      'Mapping after Object.assign:',
      JSON.stringify(mapping, null, 2),
    );

    const saved = await this.mappingRepo.save(mapping);

    console.log('Saved mapping:', JSON.stringify(saved, null, 2));

    return saved;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async remove(
    @Param('fromClassId', ParseIntPipe) fromClassId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const mapping = await this.mappingRepo.findOne({
      where: { id, fromClassId },
    });
    if (!mapping) throw new Error('Mapping not found');
    await this.mappingRepo.remove(mapping);
    return { success: true };
  }
}
