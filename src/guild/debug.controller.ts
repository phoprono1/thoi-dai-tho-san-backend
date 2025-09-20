/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { GuildService } from './guild.service';

/**
 * Dev-only endpoint to inspect and attempt to clean stale guild membership for a user.
 * POST /debug/guild/clean-stale { userId }
 */
@Controller('debug/guild')
export class DebugGuildController {
  constructor(private readonly guildService: GuildService) {}

  @Post('clean-stale')
  async cleanStale(@Body() body: { userId?: number }) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Not allowed in production');
    }
    const userId = Number(body?.userId ?? 0);
    if (!userId || Number.isNaN(userId)) {
      throw new BadRequestException('userId required');
    }

    // Call a small helper on the service to run the same cleanup logic.
    // We'll implement a thin wrapper inside the service to reuse logic.
    const res = await (this.guildService as any)._dev_cleanStaleMembership?.(
      userId,
    );
    return { ok: true, result: res };
  }

  @Post('create')
  async createGuild(
    @Body() body: { userId?: number; name?: string; description?: string },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Not allowed in production');
    }
    const userId = Number(body?.userId ?? 0);
    if (!userId || Number.isNaN(userId)) {
      throw new BadRequestException('userId required');
    }
    const name = String(body?.name ?? `dev-guild-${Date.now()}`);
    const description = body?.description ?? null;
    try {
      const created = await this.guildService.createGuild(
        userId,
        name,
        description as any,
      );
      return { ok: true, created };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message ?? String(err),
        stack: err?.stack,
      };
    }
  }
}
