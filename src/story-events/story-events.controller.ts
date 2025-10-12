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
} from '@nestjs/common';
import { StoryEventsService, RewardSpec } from './story-events.service';
import { CreateStoryEventDto } from './dto/create-story-event.dto';
import { UpdateStoryEventDto } from './dto/update-story-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('story-events')
export class StoryEventsController {
  constructor(private readonly svc: StoryEventsService) {}

  @Post('admin')
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(@Body() body: CreateStoryEventDto) {
    // validated DTO -> pass through to service
    return this.svc.createEvent(body as any);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/:id')
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateStoryEventDto,
    @Request() req: { user?: { isAdmin?: boolean } },
  ) {
    if (!req?.user?.isAdmin) throw new ForbiddenException('Admin only');
  return await this.svc.updateEvent(id, body as any);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/:id')
  async deleteAdmin(@Param('id', ParseIntPipe) id: number, @Request() req: { user?: { isAdmin?: boolean } }) {
    if (!req?.user?.isAdmin) throw new ForbiddenException('Admin only');
    return await this.svc.deleteEvent(id);
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getEvent(id);
  }

  @Get()
  async listActive() {
    return this.svc.listActive();
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
  ) {
    const l = Number(limit || 50);
    const o = Number(offset || 0);
    return this.svc.getTopContributors(id, l, o);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/distribute')
  async distribute(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RewardSpec,
    @Request() req: { user?: { isAdmin?: boolean } },
  ) {
    if (!req?.user?.isAdmin) throw new ForbiddenException('Admin only');
    const spec: RewardSpec = body || { mode: 'pool' };
    if (!spec.mode) spec.mode = 'pool';
    return this.svc.distributeRewards(id, spec);
  }
}
