import {
  Controller,
  Post,
  Body,
  Req,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ExploreService } from './explore.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('explore/wildarea')
export class ExploreController {
  constructor(private readonly exploreService: ExploreService) {}

  @UseGuards(JwtAuthGuard)
  @Post('start')
  async start(
    @Req() req: Request & { user?: { id?: number } },
    @Body() body: { preferredCount?: number },
  ) {
    // Debug: log incoming auth header and user for troubleshooting
    try {
      const authHdr = (req as any)?.headers?.authorization ?? null;
      console.log('ExploreController.start - Authorization header:', authHdr);
      console.log('ExploreController.start - req.user present:', !!req.user);
    } catch {
      // ignore
    }

    const user = req.user;
    if (!user || typeof user.id !== 'number')
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    const getErrorMessage = (e: unknown) => {
      if (!e) return 'Internal Error';
      if (typeof e === 'string') return e;
      if (typeof e === 'object' && e !== null) {
        try {
          // attempt to read message property safely
          const m = (e as { message?: unknown }).message;
          if (typeof m === 'string') return m;
          if (m != null) return String(m);
        } catch {
          // ignore and fallback
        }
      }
      return 'Internal Error';
    };

    try {
      const result = await this.exploreService.startWildAreaRun(
        user.id,
        body?.preferredCount,
      );
      return result;
    } catch (err: unknown) {
      throw new HttpException(getErrorMessage(err), HttpStatus.BAD_REQUEST);
    }
  }
}
