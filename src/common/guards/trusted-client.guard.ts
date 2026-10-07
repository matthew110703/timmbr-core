import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

/** Restricts an endpoint to trusted server clients (the storefront BFF). */
@Injectable()
export class TrustedClientGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (!request.trustedClient) {
      throw new ForbiddenException({
        code: 'TRUSTED_CLIENT_REQUIRED',
        message: 'This endpoint is only available to trusted server clients.',
      });
    }
    return true;
  }
}
