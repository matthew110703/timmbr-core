import { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Application } from '@/common/types/application.types';
import { env } from './env';
import { secondsUntilJwtExpiry } from '@/auth/utils/jwt-expiry.util';

/** Refresh cookies are only needed by the auth routes (refresh, logout, password). */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

/**
 * One cookie per app on the API host, so signing in to the Admin Console
 * doesn't replace the storefront session in the same browser (and vice versa).
 * Requests without a recognised Origin (e.g. the OAuth redirect) are storefront.
 */
export function refreshCookieName(application?: Application): string {
  return application === Application.ADMIN_CONSOLE ? 'rt_admin' : 'rt_sf';
}

export function getCookieOptions(): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV !== 'dev',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(
  reply: FastifyReply,
  application: Application | undefined,
  refreshToken: string,
) {
  // The cookie lives exactly as long as the token inside it.
  reply.setCookie(refreshCookieName(application), refreshToken, {
    ...getCookieOptions(),
    maxAge: secondsUntilJwtExpiry(refreshToken),
  });
}

export function clearRefreshCookie(reply: FastifyReply, application: Application | undefined) {
  reply.clearCookie(refreshCookieName(application), { path: REFRESH_COOKIE_PATH });
}

export function readRefreshCookie(req: FastifyRequest): string | undefined {
  return req.cookies?.[refreshCookieName(req.application)];
}

/**
 * The refresh token for refresh/logout: from the app cookie (browsers), or
 * from `body.refreshToken` for trusted clients (the storefront BFF), which
 * keep it in their own cookie on the storefront domain.
 */
export function readRefreshToken(req: FastifyRequest): string | undefined {
  if (req.trustedClient) {
    const fromBody = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
    if (typeof fromBody === 'string' && fromBody) return fromBody;
  }
  return readRefreshCookie(req);
}
