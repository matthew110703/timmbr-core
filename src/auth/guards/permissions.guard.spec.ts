import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PermissionsGuard } from './permissions.guard';
import { STAFF_PERMISSIONS } from '@/common/constants/permissions.constant';

describe('PermissionsGuard', () => {
  let reflector: Reflector;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const makeContext = (user?: any): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  it('allows access when no permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it.each([UserRole.ADMIN, UserRole.MASTER])(
    'allows %s users without checking granular permissions',
    (role) => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([STAFF_PERMISSIONS.ORDERS_CANCEL]);
      expect(guard.canActivate(makeContext({ sub: 'u1', role, permissions: [] }))).toBe(true);
    },
  );

  it('allows STAFF users who hold all required permissions', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([STAFF_PERMISSIONS.ORDERS_READ, STAFF_PERMISSIONS.ORDERS_UPDATE]);
    const user = {
      sub: 's1',
      role: UserRole.STAFF,
      permissions: [
        STAFF_PERMISSIONS.ORDERS_READ,
        STAFF_PERMISSIONS.ORDERS_UPDATE,
        STAFF_PERMISSIONS.ORDERS_MESSAGE,
      ],
    };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it('rejects STAFF users missing any required permission', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([STAFF_PERMISSIONS.ORDERS_READ, STAFF_PERMISSIONS.ORDERS_DELIVER]);
    const user = {
      sub: 's1',
      role: UserRole.STAFF,
      permissions: [STAFF_PERMISSIONS.ORDERS_READ],
    };
    expect(() => guard.canActivate(makeContext(user))).toThrow(ForbiddenException);
  });

  it('rejects customer USER accounts when permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([STAFF_PERMISSIONS.ORDERS_READ]);
    expect(() =>
      guard.canActivate(makeContext({ sub: 'c1', role: UserRole.USER, permissions: [] })),
    ).toThrow(ForbiddenException);
  });
});
