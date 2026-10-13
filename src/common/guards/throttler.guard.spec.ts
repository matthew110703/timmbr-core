import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TRUSTED_UNTHROTTLED_KEY } from '@/common/decorators/trusted-unthrottled.decorator';
import { RateLimitedException } from '@/common/exceptions/auth.exception';
import { AppThrottlerGuard } from './throttler.guard';

describe('AppThrottlerGuard', () => {
  it('throws RATE_LIMITED with the seconds left on the block', () => {
    const guard = Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;
    const throwIt = () =>
      (guard as any).throwThrottlingException(
        {},
        {
          timeToBlockExpire: 42,
        },
      );

    expect(throwIt).toThrow(RateLimitedException);
    try {
      throwIt();
    } catch (err) {
      const e = err as RateLimitedException;
      expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(e.getResponse()).toMatchObject({
        code: 'RATE_LIMITED',
        details: { retryAfter: 42 },
      });
    }
  });

  describe('trusted clients on @TrustedUnthrottled routes', () => {
    const handler = () => undefined;
    class Controller {}
    const contextFor = (trustedClient: boolean) =>
      ({
        switchToHttp: () => ({ getRequest: () => ({ trustedClient }) }),
        getHandler: () => handler,
        getClass: () => Controller,
      }) as unknown as ExecutionContext;

    const guardWith = (marked: boolean) => {
      const guard = Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;
      const reflector = new Reflector();
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key) => (key === TRUSTED_UNTHROTTLED_KEY ? marked : undefined));
      Object.assign(guard, { reflector });
      return guard as unknown as { shouldSkip(c: ExecutionContext): Promise<boolean> };
    };

    beforeEach(() => {
      jest.spyOn(ThrottlerGuard.prototype as never, 'shouldSkip').mockResolvedValue(false as never);
    });
    afterEach(() => jest.restoreAllMocks());

    it('skips the limit for a trusted client on a marked route', async () => {
      await expect(guardWith(true).shouldSkip(contextFor(true))).resolves.toBe(true);
    });

    it('keeps the limit for anyone else, or on unmarked routes', async () => {
      await expect(guardWith(true).shouldSkip(contextFor(false))).resolves.toBe(false);
      await expect(guardWith(false).shouldSkip(contextFor(true))).resolves.toBe(false);
    });
  });
});
