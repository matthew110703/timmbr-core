import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { env } from '@/config/env';

@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configuredSecret = env.CRON_SECRET;

    if (!configuredSecret) {
      throw new UnauthorizedException('Cron secret is not configured on server.');
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const providedSecret = request.headers['x-cron-secret'];

    if (!providedSecret || providedSecret !== configuredSecret) {
      throw new UnauthorizedException('Invalid or missing cron secret.');
    }

    return true;
  }
}
