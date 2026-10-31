import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisService } from '../../redis/redis.service';
import { HEALTH_CHECK_TIMEOUT_MS, withTimeout } from '../health.utils';

@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(
    private readonly redis: RedisService,
    private readonly indicators: HealthIndicatorService,
  ) {}

  async isHealthy<const Key extends string>(key: Key) {
    const indicator = this.indicators.check(key);
    try {
      await withTimeout(this.redis.ping(), HEALTH_CHECK_TIMEOUT_MS);
      return indicator.up();
    } catch (error) {
      // Real cause goes to logs only; the public response stays generic.
      this.logger.error(`Redis health check failed: ${(error as Error).message}`);
      return indicator.down({ message: 'unavailable' });
    }
  }
}
