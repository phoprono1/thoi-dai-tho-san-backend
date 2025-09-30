import {
  Controller,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Req,
  UseGuards,
  Get,
  Put,
  Delete,
} from '@nestjs/common';
import { Request } from 'express';
import { GachaService } from './gacha.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('gacha')
export class GachaController {
  constructor(private readonly gachaService: GachaService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('/')
  async listBoxes() {
    return this.gachaService.listBoxes();
  }

  // Player endpoint - requires auth
  @UseGuards(JwtAuthGuard)
  @Post(':id/open')
  async open(
    @Req() req: Request & { user?: { id?: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body('count') count: number = 1,
    @Body('usedKeyItemId') usedKeyItemId?: number,
  ) {
    const user = req.user;
    if (!user || typeof user.id !== 'number') throw new Error('Unauthorized');
    return this.gachaService.openBox(user.id, id, count, {
      keyItemId: usedKeyItemId,
    });
  }

  // Player-facing: get a box's public info (entries and rates)
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getBoxForPlayer(@Param('id', ParseIntPipe) id: number) {
    return this.gachaService.getBoxPublic(id);
  }

  // Player endpoint: open a box stored as a user_item (stackable inventory)
  @UseGuards(JwtAuthGuard)
  @Post('open-item/:userItemId')
  async openFromItem(
    @Req() req: Request & { user?: { id?: number } },
    @Param('userItemId', ParseIntPipe) userItemId: number,
    @Body('usedKeyItemId') usedKeyItemId?: number,
  ) {
    const user = req.user;
    if (!user || typeof user.id !== 'number') throw new Error('Unauthorized');
    return this.gachaService.openBoxFromUserItem(
      user.id,
      userItemId,
      usedKeyItemId,
    );
  }

  // Admin endpoints
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('/')
  async createBox(@Body() body: any) {
    try {
      console.log('[GachaController] createBox payload:', JSON.stringify(body));
      return await this.gachaService.createBox(body);
    } catch (err) {
      console.error('[GachaController] createBox error:', err);
      throw err;
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(':id')
  async updateBox(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    try {
      console.log(
        `[GachaController] updateBox id=${id} payload:`,
        JSON.stringify(body),
      );
      return await this.gachaService.updateBox(id, body);
    } catch (err) {
      console.error(`[GachaController] updateBox id=${id} error:`, err);
      throw err;
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async deleteBox(@Param('id', ParseIntPipe) id: number) {
    return this.gachaService.deleteBox(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('/backfill-catalog-items')
  async backfillCatalogItems() {
    return this.gachaService.backfillCatalogItems();
  }

  // Admin entry CRUD
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':boxId/entries')
  async addEntry(
    @Param('boxId', ParseIntPipe) boxId: number,
    @Body() body: any,
  ) {
    return this.gachaService.addEntry(boxId, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('entries/:entryId')
  async updateEntry(
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() body: any,
  ) {
    return this.gachaService.updateEntry(entryId, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('entries/:entryId')
  async deleteEntry(@Param('entryId', ParseIntPipe) entryId: number) {
    return this.gachaService.deleteEntry(entryId);
  }
}
