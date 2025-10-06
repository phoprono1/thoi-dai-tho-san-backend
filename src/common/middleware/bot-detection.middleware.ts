import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis.provider';

@Injectable()
export class BotDetectionMiddleware implements NestMiddleware {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const userId = (req as any).user?.id;

    if (!userId) {
      return next(); // Skip for unauthenticated requests
    }

    // Analyze request timing
    const now = Date.now();
    const timingKey = `bot_timing:${userId}`;

    // Get last request timestamp
    const lastRequest = await this.redis.get(timingKey);

    if (lastRequest) {
      const timeDiff = now - parseInt(lastRequest);

      // 🚨 Suspicious: Requests too fast (<100ms)
      if (timeDiff < 100) {
        await this.incrementBotScore(userId, 10);
      }

      // Track request pattern
      await this.trackRequestPattern(userId, timeDiff);
    }

    // Update timestamp
    await this.redis.setex(timingKey, 60, now.toString());

    // Check bot score
    const botScore = await this.getBotScore(userId);

    // 🚨 BLOCK if bot score too high
    if (botScore > 50) {
      throw new HttpException(
        'Automated behavior detected. Your account has been temporarily restricted.',
        HttpStatus.FORBIDDEN,
      );
    }

    next();
  }

  private async trackRequestPattern(userId: number, timeDiff: number) {
    const patternKey = `bot_pattern:${userId}`;

    // Store last 20 request intervals
    await this.redis.lpush(patternKey, timeDiff.toString());
    await this.redis.ltrim(patternKey, 0, 19);
    await this.redis.expire(patternKey, 300); // 5 minutes

    // Analyze pattern
    const pattern = await this.redis.lrange(patternKey, 0, 19);

    if (pattern.length >= 10) {
      const intervals = pattern.map((p) => parseInt(p));
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance =
        intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
        intervals.length;
      const stdDev = Math.sqrt(variance);

      // 🚨 Suspicious: Too consistent (bot-like)
      if (stdDev < 50 && avg < 1000) {
        await this.incrementBotScore(userId, 15);
      }
    }
  }

  private async incrementBotScore(userId: number, points: number) {
    const scoreKey = `bot_score:${userId}`;
    await this.redis.incrby(scoreKey, points);
    await this.redis.expire(scoreKey, 3600); // 1 hour decay
  }

  private async getBotScore(userId: number): Promise<number> {
    const scoreKey = `bot_score:${userId}`;
    const score = await this.redis.get(scoreKey);
    return score ? parseInt(score) : 0;
  }
}
