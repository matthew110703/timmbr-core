import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';
import { HEALTH_CHECK_TIMEOUT_MS, withTimeout } from '../health.utils';

@Injectable()
export class PrismaHealthIndicator {
  private readonly logger = new Logger(PrismaHealthIndicator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly indicators: HealthIndicatorService,
  ) {}

  async isHealthy<const Key extends string>(key: Key) {
    const indicator = this.indicators.check(key);
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, HEALTH_CHECK_TIMEOUT_MS);
      return indicator.up();
    } catch (error) {
      // Real cause goes to logs only; the public response stays generic.
      this.logger.error(`Database health check failed: ${(error as Error).message}`);
      return indicator.down({ message: 'unavailable' });
    }
  }
}
