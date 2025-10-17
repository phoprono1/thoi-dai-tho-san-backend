import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  ForbiddenException,
  Query,
  UsePipes,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { StoryEventsService, RewardSpec } from './story-events.service';
import { StoryEvent } from './story-event.entity';
import { CreateStoryEventDto } from './dto/create-story-event.dto';
import { UpdateStoryEventDto } from './dto/update-story-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('story-events')
export class StoryEventsController {
  constructor(private readonly svc: StoryEventsService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin')
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(@Body() body: CreateStoryEventDto) {
    // validated DTO -> pass through to service
    return this.svc.createEvent(body as unknown as Partial<StoryEvent>);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('admin/:id')
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateStoryEventDto,
    @Request() req: { user?: { isAdmin?: boolean } },
  ) {
    if (!req?.user?.isAdmin) throw new ForbiddenException('Admin only');
    return await this.svc.updateEvent(
      id,
      body as unknown as Partial<StoryEvent>,
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/:id')
  async deleteAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: { isAdmin?: boolean } },
  ) {
    if (!req?.user?.isAdmin) throw new ForbiddenException('Admin only');
    return await this.svc.deleteEvent(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/:id/hard')
  async hardDeleteAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: { isAdmin?: boolean } },
  ) {
    if (!req?.user?.isAdmin) throw new ForbiddenException('Admin only');
    return await this.svc.hardDeleteEvent(id);
  }

  @Get()
  async listActive() {
    try {
      return await this.svc.listActive();
    } catch (err) {
      const logger = new Logger('StoryEventsController');
      logger.error('listActive failed: ' + String(err));
      if (err instanceof Error && err.stack) logger.error(err.stack);
      // Temporary: return error details in response to aid debugging locally
      return {
        error: true,
        message: String(err),
        stack: err instanceof Error ? err.stack : undefined,
      };
    }
  }

  @Get('history')
  async listHistory() {
    try {
      return await this.svc.listHistory();
    } catch (err) {
      const logger = new Logger('StoryEventsController');
      logger.error('listHistory failed: ' + String(err));
      if (err instanceof Error && err.stack) logger.error(err.stack);
      throw err;
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/all')
  async listAll(@Request() req: { user?: { isAdmin?: boolean } }) {
    if (!req?.user?.isAdmin) throw new ForbiddenException('Admin only');
    try {
      return await this.svc.listAll();
    } catch (err) {
      const logger = new Logger('StoryEventsController');
      logger.error('listAll failed: ' + String(err));
      if (err instanceof Error && err.stack) logger.error(err.stack);
      throw err;
    }
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getEvent(id);
  }

  @Post(':id/contribute-item')
  async contributeItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { userId: number; itemId: number; quantity?: number },
  ) {
    const { userId, itemId, quantity } = body || {};
    return this.svc.contributeItem(id, userId, itemId, quantity || 1);
  }

  // Backfill endpoint removed: story events count only from event.eventStart (creation time)

  @Get(':id/leaderboard')
  async leaderboard(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<import('./story-events.service').ContribRow[]> {
    const l = Number(limit || 50);
    const o = Number(offset || 0);
    return this.svc.getTopContributors(id, l, o);
  }

  @Get(':id/global-progress')
  async globalProgress(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getGlobalProgress(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/distribute')
  async distribute(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RewardSpec,
    @Request() req: { user?: { isAdmin?: boolean; id?: number } },
  ) {
    if (!req?.user?.isAdmin) throw new ForbiddenException('Admin only');
    const spec: RewardSpec = body || { mode: 'pool' };
    if (!spec.mode) spec.mode = 'pool';
    // record executor id when available (for audit)
    const executedBy = req?.user?.id ?? null;
    try {
      return await this.svc.distributeRewards(id, spec, executedBy);
    } catch (err) {
      const logger = new Logger('StoryEventsController');
      logger.error(
        `distribute failed for event ${id} by ${executedBy ?? 'unknown'}: ` +
          String(err),
      );
      if (err instanceof Error && err.stack) logger.error(err.stack);
      // rethrow so Nest error handling returns 500 to client, but we have logs
      throw err;
    }
  }
}
