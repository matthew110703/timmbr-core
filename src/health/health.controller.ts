import { APP_ROUTES } from '@/app.routes';
import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { SkipTransform, Public } from '@/common/decorators';

/**
 * Infra probes, intentionally unversioned and outside the `/api` prefix.
 * - `GET /health/live`  — process is up (use for platform restart checks).
 * - `GET /health/ready` — DB + Redis reachable (`GET /health` is an alias, used by CI).
 */
@SkipTransform()
@Public()
@SkipThrottle()
@Controller({ path: APP_ROUTES.HEALTH, version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get(['', 'ready'])
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prismaIndicator.isHealthy('database'),
      () => this.redisIndicator.isHealthy('redis'),
    ]);
  }
}
