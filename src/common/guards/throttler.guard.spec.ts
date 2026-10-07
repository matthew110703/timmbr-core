import { HttpStatus } from '@nestjs/common';
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
});
