import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModuleOptions } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis.provider';

@Injectable()
export class CustomRateLimitGuard extends ThrottlerGuard {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    options: ThrottlerModuleOptions,
    @Inject('THROTTLER_STORAGE') storage: any,
  ) {
    super(options, storage, {} as any);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = this.getIP(request);

    // Check IP-based rate limit
    const ipKey = `rate_limit:ip:${ip}`;
    const ipCount = await this.redis.incr(ipKey);

    if (ipCount === 1) {
      await this.redis.expire(ipKey, 60); // 1 minute window
    }

    // Strict limit: 10 requests per minute per IP
    if (ipCount > 10) {
      throw new HttpException(
        'Too many requests from this IP. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return super.canActivate(context);
  }

  private getIP(request: any): string {
    // Get real IP (behind proxy/cloudflare)
    return (
      request.headers['cf-connecting-ip'] ||
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }
}
