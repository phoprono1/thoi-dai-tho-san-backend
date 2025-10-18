import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ScratchCardService } from '../casino/scratch-card/scratch-card.service';
import { PrizeType } from '../casino/scratch-card/scratch-card-type-prize.entity';

interface RequestWithUser extends Request {
  user?: {
    id: number;
    username: string;
    isAdmin: boolean;
  };
}

@ApiTags('admin/casino')
@Controller('admin/casino')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminCasinoController {
  constructor(private readonly scratchCardService: ScratchCardService) {}

  @UseGuards(JwtAuthGuard)
  @Get('scratch-cards')
  @ApiOperation({ summary: 'Admin: Get all scratch card types' })
  async getScratchCardTypes(@Request() req: RequestWithUser) {
    const isAdminCaller = !!req?.user?.isAdmin;
    if (!isAdminCaller) throw new ForbiddenException('Admin only');
    try {
      const result = await this.scratchCardService.getActiveCardTypes();
      // quick debug log to help trace server-side failures
      console.debug(
        '[AdminCasinoController] getScratchCardTypes returned',
        Array.isArray(result) ? result.length : typeof result,
      );
      return result;
    } catch (error) {
      console.error('[AdminCasinoController] getScratchCardTypes error', error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('scratch-cards')
  @ApiOperation({ summary: 'Admin: Create new scratch card type' })
  async createScratchCardType(
    @Request() req: RequestWithUser,
    @Body()
    data: {
      name: string;
      description?: string;
      costGold: number;
      gridRows?: number;
      gridCols?: number;
    },
  ) {
    const isAdminCaller = !!req?.user?.isAdmin;
    if (!isAdminCaller) throw new ForbiddenException('Admin only');

    // Log incoming payload for debugging
    console.debug('[AdminCasinoController] createScratchCardType body', data);

    // Validate required fields early to return a clear 400 error rather than DB 500
    if (!data || !data.name) {
      throw new BadRequestException('Field "name" is required');
    }

    // Coerce defaults to ensure DB defaults are used intentionally
    const payload = {
      name: data.name,
      description: data.description ?? null,
      costGold: data.costGold ?? 100,
      gridRows: data.gridRows ?? 3,
      gridCols: data.gridCols ?? 3,
    };

    try {
      const created = await this.scratchCardService.createCardType(payload);
      console.debug(
        '[AdminCasinoController] createScratchCardType',
        created.id,
      );
      return created;
    } catch (error) {
      console.error(
        '[AdminCasinoController] createScratchCardType error',
        error,
      );
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('scratch-cards/:id')
  @ApiOperation({ summary: 'Admin: Update scratch card type' })
  async updateScratchCardType(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body()
    data: Partial<{
      name: string;
      description: string;
      costGold: number;
      gridRows: number;
      gridCols: number;
      isActive: boolean;
    }>,
  ) {
    const isAdminCaller = !!req?.user?.isAdmin;
    if (!isAdminCaller) throw new ForbiddenException('Admin only');

    return this.scratchCardService.updateCardType(+id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('scratch-cards/:id')
  @ApiOperation({ summary: 'Admin: Delete scratch card type' })
  async deleteScratchCardType(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const isAdminCaller = !!req?.user?.isAdmin;
    if (!isAdminCaller) throw new ForbiddenException('Admin only');

    await this.scratchCardService.deleteCardType(+id);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('scratch-cards/:id/prizes')
  @ApiOperation({ summary: 'Admin: Add prize to scratch card type' })
  async addPrizeToScratchCard(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body()
    data: {
      prizeType: PrizeType;
      prizeValue: number;
      prizeQuantity?: number;
      probabilityWeight?: number;
      taxRate?: number;
      maxClaims?: number;
      positionRow?: number;
      positionCol?: number;
    },
  ) {
    const isAdminCaller = !!req?.user?.isAdmin;
    if (!isAdminCaller) throw new ForbiddenException('Admin only');
    try {
      const prize = await this.scratchCardService.addPrizeToCardType(+id, data);
      console.debug('[AdminCasinoController] addPrizeToScratchCard', prize.id);
      return prize;
    } catch (error) {
      console.error(
        '[AdminCasinoController] addPrizeToScratchCard error',
        error,
      );
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('scratch-cards/:id/prizes/:prizeId')
  @ApiOperation({ summary: 'Admin: Update prize on scratch card type' })
  async updatePrizeOnScratchCard(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Param('prizeId') prizeId: string,
    @Body()
    data: Partial<{
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
    const isAdminCaller = !!req?.user?.isAdmin;
    if (!isAdminCaller) throw new ForbiddenException('Admin only');

    try {
      const prize = await this.scratchCardService.updatePrize(
        +id,
        +prizeId,
        data as any,
      );

      console.debug(
        '[AdminCasinoController] updatePrizeOnScratchCard',
        prize.id,
      );

      return prize;
    } catch (error) {
      console.error(
        '[AdminCasinoController] updatePrizeOnScratchCard error',
        error,
      );
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete('scratch-cards/:id/prizes/:prizeId')
  @ApiOperation({ summary: 'Admin: Delete prize on scratch card type' })
  async deletePrizeOnScratchCard(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Param('prizeId') prizeId: string,
  ) {
    const isAdminCaller = !!req?.user?.isAdmin;
    if (!isAdminCaller) throw new ForbiddenException('Admin only');

    try {
      await this.scratchCardService.deletePrize(+id, +prizeId);

      console.debug(
        '[AdminCasinoController] deletePrizeOnScratchCard',
        prizeId,
      );

      return { success: true };
    } catch (error) {
      console.error(
        '[AdminCasinoController] deletePrizeOnScratchCard error',
        error,
      );
      throw error;
    }
  }
}
