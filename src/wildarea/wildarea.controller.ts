import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WildAreaService } from './wildarea.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@ApiTags('wildarea')
@Controller('wildarea')
export class WildAreaController {
  constructor(private readonly wildAreaService: WildAreaService) {}

  // Public endpoints
  @Get('monsters')
  @ApiOperation({ summary: 'Get all wildarea monsters' })
  async getAllMonsters() {
    return this.wildAreaService.findAll();
  }

  @Get('monsters/level/:level')
  @ApiOperation({ summary: 'Get monsters available for specific level' })
  async getMonstersByLevel(@Param('level') level: string) {
    const playerLevel = parseInt(level);
    return this.wildAreaService.findByLevelRange(playerLevel);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get wildarea statistics' })
  async getStats() {
    return this.wildAreaService.getStats();
  }

  // Admin endpoints
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin')
  @ApiOperation({ summary: 'Admin: Get all wildarea monsters' })
  async adminGetAll() {
    return this.wildAreaService.findAll();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/:id')
  @ApiOperation({ summary: 'Admin: Get wildarea monster by ID' })
  async adminGetById(@Param('id') id: string) {
    return this.wildAreaService.findById(parseInt(id));
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin')
  @ApiOperation({ summary: 'Admin: Add monster to wildarea' })
  async adminCreate(
    @Body()
    data: {
      monsterId: number;
      minLevel: number;
      maxLevel: number;
      spawnWeight?: number;
      description?: string;
    },
  ) {
    return this.wildAreaService.create(data);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('admin/:id')
  @ApiOperation({ summary: 'Admin: Update wildarea monster' })
  async adminUpdate(
    @Param('id') id: string,
    @Body()
    data: {
      minLevel?: number;
      maxLevel?: number;
      spawnWeight?: number;
      description?: string;
      isActive?: boolean;
    },
  ) {
    return this.wildAreaService.update(parseInt(id), data);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/:id')
  @ApiOperation({ summary: 'Admin: Remove monster from wildarea' })
  async adminDelete(@Param('id') id: string, @Query('hard') hard?: string) {
    const wildAreaId = parseInt(id);
    if (hard === 'true') {
      await this.wildAreaService.hardDelete(wildAreaId);
    } else {
      await this.wildAreaService.delete(wildAreaId);
    }
    return { message: 'Monster removed from wildarea successfully' };
  }
}
