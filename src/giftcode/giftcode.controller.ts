import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
  ParseIntPipe,
  Delete,
  Patch,
} from '@nestjs/common';
import { GiftCodeService } from './giftcode.service';
import { CreateGiftCodeDto, RedeemGiftCodeDto } from './giftcode.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('giftcode')
export class GiftCodeController {
  constructor(private readonly svc: GiftCodeService) {}

  @UseGuards(JwtAuthGuard)
  @Post('redeem')
  async redeem(@Request() req: any, @Body() dto: RedeemGiftCodeDto) {
    return this.svc.redeem(req.user.id, dto.code);
  }

  // Admin: create a giftcode
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('create')
  async create(@Body() dto: CreateGiftCodeDto) {
    return this.svc.create(dto);
  }

  // Admin: list giftcodes
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('list')
  async list() {
    return this.svc.findAll();
  }

  // Admin: deactivate (mark inactive) a giftcode by id
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('deactivate/:id')
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deactivate(id);
  }

  // Admin: permanently delete a giftcode by id
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
