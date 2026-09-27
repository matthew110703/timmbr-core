import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OriginGuard } from './origin.guard';
import { Application } from '../types/application.types';

describe('OriginGuard', () => {
  let guard: OriginGuard;

  beforeEach(() => {
    guard = new OriginGuard();
  });

  function createMockContext(originHeader?: string): {
    context: ExecutionContext;
    req: { headers: Record<string, string | undefined>; application?: Application };
  } {
    const req = {
      headers: {
        origin: originHeader,
      },
      application: undefined as Application | undefined,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;

    return { context, req };
  }

  it('should allow requests from STOREFRONT origin and set application to STOREFRONT', () => {
    const { context, req } = createMockContext('http://localhost:3000');
    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(req.application).toBe(Application.STOREFRONT);
  });

  it('should allow requests from ADMIN_CONSOLE origin and set application to ADMIN_CONSOLE', () => {
    const { context, req } = createMockContext('http://localhost:5000');
    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(req.application).toBe(Application.ADMIN_CONSOLE);
  });

  it('should normalize trailing slashes in the origin header', () => {
    const { context, req } = createMockContext('http://localhost:5000/');
    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(req.application).toBe(Application.ADMIN_CONSOLE);
  });

  it('should reject unconfigured browser origins with ForbiddenException', () => {
    const { context } = createMockContext('http://malicious-site.com');

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow server-to-server requests without Origin header and leave application undefined', () => {
    const { context, req } = createMockContext(undefined);
    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(req.application).toBeUndefined();
  });
});
