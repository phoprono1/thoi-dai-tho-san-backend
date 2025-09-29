import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { Dungeon } from '../dungeons/dungeon.entity';
import { Quest } from '../quests/quest.entity';
import { Item } from '../items/item.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminResourcesController {
  constructor(
    @InjectRepository(Dungeon)
    private dungeonRepo: Repository<Dungeon>,
    @InjectRepository(Quest)
    private questRepo: Repository<Quest>,
    @InjectRepository(Item)
    private itemRepo: Repository<Item>,
  ) {}

  @Get('dungeons')
  async getDungeons() {
    const dungeons = await this.dungeonRepo.find({
      select: ['id', 'name', 'levelRequirement'],
      order: { levelRequirement: 'ASC', name: 'ASC' },
    });
    return dungeons.map((d) => ({
      id: d.id,
      name: d.name,
      level: d.levelRequirement,
    }));
  }

  @Get('quests')
  async getQuests() {
    const quests = await this.questRepo.find({
      select: ['id', 'name', 'requiredLevel'],
      order: { requiredLevel: 'ASC', name: 'ASC' },
    });
    return quests.map((q) => ({
      id: q.id,
      title: q.name,
      level: q.requiredLevel,
    }));
  }

  @Get('items')
  async getItems() {
    const items = await this.itemRepo.find({
      select: ['id', 'name', 'rarity'],
      order: { rarity: 'ASC', name: 'ASC' },
    });
    return items;
  }
}
