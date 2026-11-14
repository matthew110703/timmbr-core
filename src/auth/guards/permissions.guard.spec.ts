import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { JwtPayload } from '@/auth/types/jwt.types';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS } from '@/common/constants/permissions.constant';

describe('PermissionsGuard', () => {
  let reflector: Reflector;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const makeContext = (user?: Partial<JwtPayload>): ExecutionContext =>
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

  it('allows MASTER users without checking granular permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([PERMISSIONS.ORDERS_CANCEL]);
    expect(
      guard.canActivate(makeContext({ sub: 'm1', role: UserRole.MASTER, permissions: [] })),
    ).toBe(true);
  });

  it('allows ADMIN users who hold all required permissions', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_UPDATE]);
    const user = {
      sub: 'a1',
      role: UserRole.ADMIN,
      permissions: [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_UPDATE],
    };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it('rejects ADMIN users missing any required permission', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PERMISSIONS.USERS_READ, PERMISSIONS.ADMINS_CREATE]);
    const user = {
      sub: 'a1',
      role: UserRole.ADMIN,
      permissions: [PERMISSIONS.USERS_READ],
    };
    expect(() => guard.canActivate(makeContext(user))).toThrow(ForbiddenException);
  });

  it('allows STAFF users who hold all required permissions', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_UPDATE]);
    const user = {
      sub: 's1',
      role: UserRole.STAFF,
      permissions: [PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_UPDATE, PERMISSIONS.ORDERS_MESSAGE],
    };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it('rejects STAFF users missing any required permission', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_DELIVER]);
    const user = {
      sub: 's1',
      role: UserRole.STAFF,
      permissions: [PERMISSIONS.ORDERS_READ],
    };
    expect(() => guard.canActivate(makeContext(user))).toThrow(ForbiddenException);
  });

  it('rejects customer USER accounts when permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([PERMISSIONS.ORDERS_READ]);
    expect(() =>
      guard.canActivate(makeContext({ sub: 'c1', role: UserRole.USER, permissions: [] })),
    ).toThrow(ForbiddenException);
  });
});
