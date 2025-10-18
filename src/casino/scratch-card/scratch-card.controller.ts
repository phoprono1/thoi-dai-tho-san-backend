import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
  Delete,
} from '@nestjs/common';
import { ScratchCardService } from './scratch-card.service';
import { PrizeType } from './scratch-card-type-prize.entity';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AdminGuard } from '../../auth/admin.guard';

@Controller('casino/scratch-cards')
@UseGuards(JwtAuthGuard)
export class ScratchCardController {
  constructor(private readonly scratchCardService: ScratchCardService) {}

  // Get all active card types
  @Get('types')
  async getActiveCardTypes() {
    const cardTypes = await this.scratchCardService.getActiveCardTypes();
    return {
      success: true,
      data: cardTypes,
    };
  }

  // Get specific card type
  @Get('types/:id')
  async getCardType(@Param('id', ParseIntPipe) id: number) {
    const cardType = await this.scratchCardService.getCardTypeById(id);
    return {
      success: true,
      data: cardType,
    };
  }

  // Purchase a scratch card
  @Post('purchase/:cardTypeId')
  async purchaseCard(
    @Param('cardTypeId', ParseIntPipe) cardTypeId: number,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    try {
      const card = await this.scratchCardService.purchaseCard(
        userId,
        cardTypeId,
      );
      return {
        success: true,
        message: 'Card purchased successfully',
        data: card,
      };
    } catch (error) {
      console.error('[ScratchCardController] purchaseCard error', error);
      throw error;
    }
  }

  // Get user's scratch cards
  @Get('my-cards')
  async getUserCards(@Request() req: any) {
    const userId = req.user.id;
    const cards = await this.scratchCardService.getUserCards(userId);
    return {
      success: true,
      data: cards,
    };
  }

  // Get specific user card
  @Get('my-cards/:cardId')
  async getUserCard(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const card = await this.scratchCardService.getUserCard(userId, cardId);
    return {
      success: true,
      data: card,
    };
  }

  // Scratch a position
  @Post(':cardId/scratch')
  async scratchPosition(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() body: { row: number; col: number },
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const result = await this.scratchCardService.scratchPosition(
      userId,
      cardId,
      body.row,
      body.col,
    );
    return {
      success: true,
      message: 'Position scratched successfully',
      data: result,
    };
  }

  // Admin: Create card type
  @Post('admin/types')
  @UseGuards(AdminGuard)
  async createCardType(
    @Body()
    body: {
      name: string;
      description?: string;
      backgroundImageUrl?: string;
      costGold: number;
      gridRows?: number;
      gridCols?: number;
    },
  ) {
    const cardType = await this.scratchCardService.createCardType(body);
    return {
      success: true,
      message: 'Card type created successfully',
      data: cardType,
    };
  }

  // Admin: Add prize to card type
  @Post('admin/types/:cardTypeId/prizes')
  @UseGuards(AdminGuard)
  async addPrizeToCardType(
    @Param('cardTypeId', ParseIntPipe) cardTypeId: number,
    @Body()
    body: {
      prizeType: PrizeType;
      prizeValue: number;
      prizeQuantity?: number;
      probabilityWeight?: number;
      taxRate?: number;
      maxClaims?: number;
      positionRow: number;
      positionCol: number;
    },
  ) {
    const prize = await this.scratchCardService.addPrizeToCardType(
      cardTypeId,
      body,
    );
    return {
      success: true,
      message: 'Prize added successfully',
      data: prize,
    };
  }

  // Admin: Update prize
  @Post('admin/types/:cardTypeId/prizes/:prizeId')
  @UseGuards(AdminGuard)
  async updatePrize(
    @Param('cardTypeId', ParseIntPipe) cardTypeId: number,
    @Param('prizeId', ParseIntPipe) prizeId: number,
    @Body()
    body: Partial<{
      prizeType: PrizeType;
      prizeValue: number;
      prizeQuantity?: number;
      probabilityWeight?: number;
      taxRate?: number;
      maxClaims?: number;
      positionRow?: number;
      positionCol?: number;
    }>,
  ) {
    const prize = await this.scratchCardService.updatePrize(
      cardTypeId,
      prizeId,
      body,
    );
    return {
      success: true,
      message: 'Prize updated successfully',
      data: prize,
    };
  }

  // Admin: Delete prize
  @Delete('admin/types/:cardTypeId/prizes/:prizeId')
  @UseGuards(AdminGuard)
  async deletePrize(
    @Param('cardTypeId', ParseIntPipe) cardTypeId: number,
    @Param('prizeId', ParseIntPipe) prizeId: number,
  ) {
    await this.scratchCardService.deletePrize(cardTypeId, prizeId);
    return {
      success: true,
      message: 'Prize deleted successfully',
    };
  }

  // Admin: Create title tax reduction
  @Post('admin/title-tax-reductions')
  @UseGuards(AdminGuard)
  async createTitleTaxReduction(
    @Body() body: { titleId: number; taxReductionPercentage: number },
  ) {
    const taxReduction = await this.scratchCardService.createTitleTaxReduction(
      body.titleId,
      body.taxReductionPercentage,
    );
    return {
      success: true,
      message: 'Title tax reduction created successfully',
      data: taxReduction,
    };
  }
}
