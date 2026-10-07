import { fakeJwt } from '@/common/testing/fake-jwt';
import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { of, lastValueFrom } from 'rxjs';
import type { FastifyRequest } from 'fastify';
import { readRefreshToken } from '@/config/cookie.config';
import { SessionCookieInterceptor } from '@/auth/interceptors/SessionCookieInterceptor';
import { TrustedClientGuard } from './guards/trusted-client.guard';
import { AppThrottlerGuard } from './guards/throttler.guard';
import { clientIp, isTrustedClientKey } from './trusted-client';

const KEY = 'test-internal-key-0123456789abcdef0123';

const req = (overrides: Record<string, unknown> = {}) =>
  ({ headers: {}, cookies: {}, ip: '10.0.0.1', ...overrides }) as unknown as FastifyRequest;

const httpContext = (request: FastifyRequest, reply: unknown = {}) =>
  ({
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => reply }),
  }) as unknown as ExecutionContext;

describe('isTrustedClientKey', () => {
  it('accepts only the exact configured key', () => {
    expect(isTrustedClientKey(KEY)).toBe(true);
    expect(isTrustedClientKey(`${KEY}x`)).toBe(false);
    expect(isTrustedClientKey('nope')).toBe(false);
    expect(isTrustedClientKey(undefined)).toBe(false);
    expect(isTrustedClientKey([KEY])).toBe(false);
  });
});

describe('clientIp', () => {
  it('uses the forwarded end-user IP only for trusted clients', () => {
    const headers = { 'x-timmbr-client-ip': '203.0.113.7, 10.0.0.2' };

    expect(clientIp(req({ trustedClient: true, headers }))).toBe('203.0.113.7');
    expect(clientIp(req({ trustedClient: false, headers }))).toBe('10.0.0.1');
  });
});

describe('AppThrottlerGuard tracker', () => {
  it('tracks trusted requests by the forwarded IP', async () => {
    const guard = Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;
    const tracker = (guard as any).getTracker(
      req({ trustedClient: true, headers: { 'x-timmbr-client-ip': '203.0.113.7' } }),
    );

    await expect(tracker).resolves.toBe('203.0.113.7');
  });

  const tracker = (request: FastifyRequest) =>
    (
      Object.create(AppThrottlerGuard.prototype).getTracker as (
        r: FastifyRequest,
      ) => Promise<string>
    )(request);

  it('tracks signed-in requests per user (valid access token)', async () => {
    const token = new JwtService().sign({ sub: 'u42' }, { secret: 'test-access-secret' });

    await expect(tracker(req({ headers: { authorization: `Bearer ${token}` } }))).resolves.toBe(
      'user:u42',
    );
  });

  it('falls back to the IP for forged or expired tokens', async () => {
    const forged = new JwtService().sign({ sub: 'u42' }, { secret: 'not-the-secret' });
    const expired = new JwtService().sign(
      { sub: 'u42' },
      { secret: 'test-access-secret', expiresIn: -10 },
    );

    await expect(tracker(req({ headers: { authorization: `Bearer ${forged}` } }))).resolves.toBe(
      '10.0.0.1',
    );
    await expect(tracker(req({ headers: { authorization: `Bearer ${expired}` } }))).resolves.toBe(
      '10.0.0.1',
    );
  });
});

describe('TrustedClientGuard', () => {
  it('lets trusted clients through and rejects everyone else', () => {
    const guard = new TrustedClientGuard();

    expect(guard.canActivate(httpContext(req({ trustedClient: true })))).toBe(true);
    expect(() => guard.canActivate(httpContext(req()))).toThrow('trusted server clients');
  });
});

describe('readRefreshToken', () => {
  it('reads the body only for trusted clients', () => {
    const body = { refreshToken: 'from-body' };
    const cookies = { rt_sf: 'from-cookie' };

    expect(readRefreshToken(req({ trustedClient: true, body, cookies }))).toBe('from-body');
    expect(readRefreshToken(req({ trustedClient: false, body, cookies }))).toBe('from-cookie');
  });
});

describe('SessionCookieInterceptor', () => {
  const session = { id: 'u1', accessToken: 'at', refreshToken: fakeJwt(7 * 86400) };

  it('moves the refresh token into a cookie for browsers', async () => {
    const reply = { setCookie: jest.fn() };
    const result = await lastValueFrom(
      new SessionCookieInterceptor().intercept(httpContext(req(), reply), {
        handle: () => of(session as any),
      }),
    );

    expect(result).toEqual({ id: 'u1', accessToken: 'at' });
    expect(reply.setCookie).toHaveBeenCalledWith(
      'rt_sf',
      session.refreshToken,
      expect.objectContaining({ maxAge: expect.any(Number) }),
    );
  });

  it('keeps it in the body for trusted clients', async () => {
    const reply = { setCookie: jest.fn() };
    const result = await lastValueFrom(
      new SessionCookieInterceptor().intercept(httpContext(req({ trustedClient: true }), reply), {
        handle: () => of(session as any),
      }),
    );

    expect(result).toEqual(session);
    expect(reply.setCookie).not.toHaveBeenCalled();
  });
});
