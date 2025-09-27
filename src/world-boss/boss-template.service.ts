import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BossTemplate } from './boss-template.entity';
import {
  CreateBossTemplateDto,
  UpdateBossTemplateDto,
  BossTemplateResponseDto,
} from './world-boss.dto';

@Injectable()
export class BossTemplateService {
  constructor(
    @InjectRepository(BossTemplate)
    private bossTemplateRepository: Repository<BossTemplate>,
  ) {}

  async createTemplate(
    dto: CreateBossTemplateDto,
  ): Promise<BossTemplateResponseDto> {
    const template = this.bossTemplateRepository.create(dto);
    const savedTemplate = await this.bossTemplateRepository.save(template);
    return this.mapToResponseDto(savedTemplate);
  }

  async getAllTemplates(): Promise<BossTemplateResponseDto[]> {
    const templates = await this.bossTemplateRepository.find({
      order: { createdAt: 'DESC' },
    });
    return templates.map((template) => this.mapToResponseDto(template));
  }

  async getActiveTemplates(): Promise<BossTemplateResponseDto[]> {
    const templates = await this.bossTemplateRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
    return templates.map((template) => this.mapToResponseDto(template));
  }

  async getTemplateById(id: number): Promise<BossTemplateResponseDto> {
    const template = await this.bossTemplateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Boss template with ID ${id} not found`);
    }

    return this.mapToResponseDto(template);
  }

  async updateTemplate(
    id: number,
    dto: UpdateBossTemplateDto,
  ): Promise<BossTemplateResponseDto> {
    const template = await this.bossTemplateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Boss template with ID ${id} not found`);
    }

    Object.assign(template, dto);
    const updatedTemplate = await this.bossTemplateRepository.save(template);
    return this.mapToResponseDto(updatedTemplate);
  }

  async deleteTemplate(id: number): Promise<void> {
    const result = await this.bossTemplateRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Boss template with ID ${id} not found`);
    }
  }

  async getTemplatesByCategory(
    category: string,
  ): Promise<BossTemplateResponseDto[]> {
    const templates = await this.bossTemplateRepository.find({
      where: { category, isActive: true },
      order: { createdAt: 'DESC' },
    });
    return templates.map((template) => this.mapToResponseDto(template));
  }

  private mapToResponseDto(template: BossTemplate): BossTemplateResponseDto {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      level: template.level,
      image: template.image,
      stats: template.stats,
      damagePhases: template.damagePhases,
      defaultRewards: template.defaultRewards,
      isActive: template.isActive,
      category: template.category,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}
