import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
} from '@nestjs/common';
import { GiftCodeService } from './giftcode.service';
import { CreateGiftCodeDto, RedeemGiftCodeDto } from './giftcode.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('giftcode')
export class GiftCodeController {
  constructor(private readonly svc: GiftCodeService) {}

  @UseGuards(JwtAuthGuard)
  @Post('redeem')
  async redeem(@Request() req: any, @Body() dto: RedeemGiftCodeDto) {
    return this.svc.redeem(req.user.id, dto.code);
  }

  // Admin create: reuse guard or leave for later
  @Post('create')
  async create(@Body() dto: CreateGiftCodeDto) {
    return this.svc.create(dto);
  }

  @Get('list')
  async list() {
    return this.svc.findAll();
  }
}
