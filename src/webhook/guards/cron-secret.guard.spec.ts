import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CronSecretGuard } from './cron-secret.guard';
import { env } from '@/config/env';

jest.mock('@/config/env', () => ({
  env: {
    CRON_SECRET: 'test-secret',
  },
}));

describe('CronSecretGuard', () => {
  let guard: CronSecretGuard;

  beforeEach(() => {
    guard = new CronSecretGuard();
    (env as any).CRON_SECRET = 'my-secret-token';
  });

  const createMockContext = (headerValue?: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-cron-secret': headerValue,
          },
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('allows access when valid x-cron-secret header matches configured secret', () => {
    (env as any).CRON_SECRET = 'my-secret-token';
    const context = createMockContext('my-secret-token');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws UnauthorizedException when server has no secret configured', () => {
    (env as any).CRON_SECRET = undefined;
    const context = createMockContext('my-secret-token');

    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Cron secret is not configured on server.'),
    );
  });

  it('throws UnauthorizedException when header is missing', () => {
    (env as any).CRON_SECRET = 'my-secret-token';
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Invalid or missing cron secret.'),
    );
  });

  it('throws UnauthorizedException when header does not match', () => {
    (env as any).CRON_SECRET = 'my-secret-token';
    const context = createMockContext('wrong-token');

    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Invalid or missing cron secret.'),
    );
  });
});
