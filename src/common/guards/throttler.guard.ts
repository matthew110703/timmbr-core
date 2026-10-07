import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { env } from '@/config/env';
import { RateLimitedException } from '@/common/exceptions/auth.exception';
import { clientIp } from '@/common/trusted-client';

/** Stateless verifier: only checks signature + expiry of access tokens. */
const accessTokens = new JwtService({ secret: env.JWT_ACCESS_SECRET });

/**
 * Same limits as Nest's ThrottlerGuard, with two changes:
 * - who is counted:
 *   - signed-in requests (valid access token) per user, so shoppers served by
 *     one storefront server don't share that server's IP bucket;
 *   - everything else per end-user IP (forwarded by the trusted storefront
 *     BFF, otherwise the connection IP);
 * - the 429 uses the API's error envelope: a stable `RATE_LIMITED` code plus
 *   `details.retryAfter` (seconds), so clients can show how long to wait.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const request = req as FastifyRequest;
    const userId = verifiedUserId(request);
    return Promise.resolve(userId ? `user:${userId}` : clientIp(request));
  }

  protected throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new RateLimitedException(Math.max(1, Math.ceil(detail.timeToBlockExpire)));
  }
}

/** The `sub` of a valid access token; undefined for missing, forged or expired ones. */
function verifiedUserId(request: FastifyRequest): string | undefined {
  const header = request.headers?.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return undefined;

  try {
    const payload = accessTokens.verify<{ sub?: unknown }>(header.slice('Bearer '.length));
    return typeof payload.sub === 'string' ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}
