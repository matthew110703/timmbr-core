import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { setRefreshCookie } from '@/config/cookie.config';
import { AuthSession } from '../auth.mapper';

/**
 * Delivers the refresh token of a sign-in result:
 * - browser clients (admin console): moved into the app's httpOnly cookie;
 * - trusted clients (storefront BFF): left in the body, the BFF stores it in
 *   its own httpOnly cookie on the storefront domain.
 */
@Injectable()
export class SessionCookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<AuthSession>): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    return next.handle().pipe(
      map((session) => {
        if (req.trustedClient) return session;

        const { refreshToken, ...rest } = session;
        setRefreshCookie(reply, req.application, refreshToken);
        return rest;
      }),
    );
  }
}
