import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { env } from '@/config/env';
import { Application } from '../types/application.types';

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly storefrontOrigins: string[];
  private readonly adminConsoleOrigins: string[];
  private readonly otherAllowedOrigins: string[];

  constructor() {
    this.storefrontOrigins = this.parseOrigins(env.STOREFRONT_ORIGIN);
    this.adminConsoleOrigins = this.parseOrigins(env.ADMIN_CONSOLE_ORIGIN);
    this.otherAllowedOrigins = env.ALLOWED_ORIGIN ? this.parseOrigins(env.ALLOWED_ORIGIN) : [];
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const rawOrigin = request.headers['origin'] || request.headers.origin;

    // Requests without an Origin header (e.g. server-to-server webhooks, health checks, cron jobs)
    if (!rawOrigin || typeof rawOrigin !== 'string') {
      request.application = undefined;
      return true;
    }

    const normalizedOrigin = this.normalizeOrigin(rawOrigin);

    if (this.storefrontOrigins.includes(normalizedOrigin)) {
      request.application = Application.STOREFRONT;
      return true;
    }

    if (this.adminConsoleOrigins.includes(normalizedOrigin)) {
      request.application = Application.ADMIN_CONSOLE;
      return true;
    }

    if (this.otherAllowedOrigins.includes(normalizedOrigin)) {
      request.application = undefined;
      return true;
    }

    // Origin provided by browser but not recognized
    throw new ForbiddenException('Origin not allowed.');
  }

  private parseOrigins(originsString?: string): string[] {
    if (!originsString) return [];
    return originsString
      .split(',')
      .map((origin) => this.normalizeOrigin(origin))
      .filter(Boolean);
  }

  private normalizeOrigin(origin: string): string {
    return origin.trim().replace(/\/+$/, '').toLowerCase();
  }
}
