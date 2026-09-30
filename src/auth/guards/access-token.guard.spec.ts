import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessTokenGuard } from './access-token.guard';
import { IS_OPTIONAL_AUTH_KEY } from '@/common/decorators/optional-auth.decorator';

describe('AccessTokenGuard', () => {
  let guard: AccessTokenGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new AccessTokenGuard(reflector);
  });

  function createMockContext(): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  describe('canActivate', () => {
    it('should return true if route is marked with @Public()', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'isPublic') return true;
        return false;
      });

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should delegate to super.canActivate if not public', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const superCanActivateSpy = jest
        .spyOn(Object.getPrototypeOf(AccessTokenGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
      expect(superCanActivateSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('handleRequest', () => {
    it('should return user if user exists on non-optional route', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const mockUser = { sub: 'user-123', email: 'test@example.com' };
      const result = guard.handleRequest(null, mockUser, null, context);

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if no user on non-optional route', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      expect(() => guard.handleRequest(null, false, null, context)).toThrow(UnauthorizedException);
    });

    it('should return user if present on @OptionalAuth() route', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_OPTIONAL_AUTH_KEY) return true;
        return false;
      });

      const mockUser = { sub: 'user-123', email: 'test@example.com' };
      const result = guard.handleRequest(null, mockUser, null, context);

      expect(result).toEqual(mockUser);
    });

    it('should return null instead of throwing if no user on @OptionalAuth() route', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_OPTIONAL_AUTH_KEY) return true;
        return false;
      });

      const result = guard.handleRequest(null, false, null, context);
      expect(result).toBeNull();
    });

    it('should return null instead of throwing if error occurred on @OptionalAuth() route', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_OPTIONAL_AUTH_KEY) return true;
        return false;
      });

      const result = guard.handleRequest(new Error('Token expired'), false, null, context);
      expect(result).toBeNull();
    });
  });
});
