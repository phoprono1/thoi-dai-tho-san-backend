/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Param,
  UseGuards,
  Request,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserStatsService } from '../user-stats/user-stats.service';
import { AdminService } from './admin.service';
import { Queue } from 'bullmq';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly userStatsService: UserStatsService,
    private readonly adminService: AdminService,
  ) {}
  @UseGuards(JwtAuthGuard)
  @Post('reset-user/:userId')
  @ApiOperation({
    summary: 'Admin: Reset một người chơi về level 1 và chỉ số mặc định',
  })
  async resetUser(@Param('userId') userId: string, @Request() req: any) {
    const maybe = req as unknown;
    const caller = maybe as any;
    const isAdminCaller = !!caller?.user?.isAdmin;
    if (!isAdminCaller) throw new ForbiddenException('Admin only');

    const result = await this.adminService.resetUser(+userId);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('reset-all-users')
  @ApiOperation({
    summary: 'Admin: Reset toàn bộ người chơi về level 1 và chỉ số mặc định',
  })
  async resetAllUsers(@Request() req: any) {
    const maybe = req as unknown;
    const caller = maybe as any;
    const isAdminCaller = !!caller?.user?.isAdmin;
    if (!isAdminCaller) throw new ForbiddenException('Admin only');
    const result = await this.adminService.resetAllUsers();
    return result;
  }

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
    // Stats are now calculated on-demand from core attributes, no need to recompute
    const userStat = await this.userStatsService.findByUserId(uid);
    if (!userStat) throw new NotFoundException('User stat not found');
    return { ok: true, userStat };
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
              // Stats are now calculated on-demand, just ensure user stats exist
              const userStat = await userStatsService.findByUserId(uid);
              if (userStat) {
                processed++;
              }
            } catch (err: unknown) {
              console.error(
                'Check user stat failed',
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
