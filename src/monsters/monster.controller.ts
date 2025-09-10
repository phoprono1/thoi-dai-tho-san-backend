import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { MonsterService } from './monster.service';
import { Monster, MonsterType } from './monster.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('monsters')
export class MonsterController {
  constructor(private readonly monsterService: MonsterService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createMonster(@Body() monsterData: Partial<Monster>): Promise<Monster> {
    return this.monsterService.createMonster(monsterData);
  }

  @Get()
  async getAllMonsters(): Promise<Monster[]> {
    return this.monsterService.getAllMonsters();
  }

  @Get('type/:type')
  async getMonstersByType(
    @Param('type') type: MonsterType,
  ): Promise<Monster[]> {
    return this.monsterService.getMonstersByType(type);
  }

  @Get('level-range')
  async getMonstersByLevelRange(
    @Query('minLevel', ParseIntPipe) minLevel: number,
    @Query('maxLevel', ParseIntPipe) maxLevel: number,
  ): Promise<Monster[]> {
    return this.monsterService.getMonstersByLevelRange(minLevel, maxLevel);
  }

  @Get(':id')
  async getMonsterById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Monster | null> {
    return this.monsterService.getMonsterById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateMonster(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: Partial<Monster>,
  ): Promise<Monster> {
    return this.monsterService.updateMonster(id, updateData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteMonster(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.monsterService.deleteMonster(id);
  }

  @Get('stats/overview')
  @UseGuards(JwtAuthGuard)
  async getMonsterStats() {
    return this.monsterService.getMonsterStats();
  }
}
