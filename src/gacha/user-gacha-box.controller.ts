import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { UserGachaBoxService } from './user-gacha-box.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { Request } from 'express';

@Controller('me/gacha')
export class UserGachaBoxController {
  constructor(private readonly svc: UserGachaBoxService) {}

  @UseGuards(JwtAuthGuard)
  @Get('instances')
  async list(@Req() req: Request & { user?: { id?: number } }) {
    const user = req.user;
    return this.svc.listForUser(user.id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('instances')
  async award(
    @Body()
    body: {
      userId: number;
      boxId: number;
      itemId?: number;
      expiresAt?: string;
    },
  ) {
    return this.svc.awardInstance(body.userId, body.boxId, {
      itemId: body.itemId,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('instances/:id/open')
  async open(
    @Req() req: Request & { user?: { id?: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user;
    return this.svc.openInstance(user.id, id);
  }
}
