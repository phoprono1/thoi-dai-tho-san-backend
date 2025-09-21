/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Param,
  UseGuards,
  Request,
  NotFoundException,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserStatsService } from '../user-stats/user-stats.service';
import { Queue } from 'bullmq';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly userStatsService: UserStatsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('backfill/user/:id')
  @ApiOperation({
    summary: 'Admin: backfill/recompute stats for a specific user',
  })
  async backfillUser(@Param('id') id: string, @Request() req: any) {
    // expect req.user to be populated by JwtAuthGuard
    const maybe = req as unknown;
    const caller = maybe as any;
    const isAdminCaller = !!caller?.user?.isAdmin;
    if (!isAdminCaller) throw new ForbiddenException('Admin only');

    const uid = Number(id);
    const res = await this.userStatsService.recomputeAndPersistForUser(uid, {
      fillCurrentHp: true,
    });
    if (!res) throw new NotFoundException('User stat not found');
    return { ok: true, userStat: res };
  }

  @UseGuards(JwtAuthGuard)
  @Post('backfill/batch')
  @ApiOperation({ summary: 'Admin: enqueue a batch backfill job' })
  async backfillBatch(@Request() req: any) {
    const maybe = req as unknown;
    const caller = maybe as any;
    const isAdminCaller = !!caller?.user?.isAdmin;
    if (!isAdminCaller) throw new ForbiddenException('Admin only');

    const connection = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    };

    // If caller requests runNow, process the backfill synchronously in this request.
    const runNow = (req.query && req.query.runNow) || false;
    const batchSize = 200;

    if (runNow === true || runNow === 'true') {
      // Create application-scoped operation and run paginated backfill
      const appContext = req.appContext as any;
      // If appContext is not provided, fall back to creating a new Queue-less run
      try {
        // Use the same service used by the worker
        const userStatsService = this.userStatsService;
        const all = await userStatsService.findAll();
        const ids = all.map((s) => s.userId).filter(Boolean);

        let processed = 0;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          for (const uid of batch) {
            try {
              await userStatsService.recomputeAndPersistForUser(uid);
              processed++;
            } catch (err: unknown) {
              console.error(
                'Backfill user failed',
                uid,
                (err as any)?.message || err,
              );
            }
          }
        }

        return { ok: true, processed };
      } catch (err) {
        console.error('Synchronous backfill failed', err);
        throw new ForbiddenException('Synchronous backfill failed');
      }
    }

    const queue = new Queue('admin-backfill', { connection });

    const job = await queue.add('backfill', { batchSize });

    return { ok: true, jobId: job.id };
  }
}
