import { UserRole, UserStatus } from '@prisma/client';
import { UserDeactivatedException } from '@/common/exceptions/user.exception';
import { AccessTokenStrategy } from './access-token.strategy';
import type { AuthRepository } from '../auth.repository';
import type { JwtPayload } from '../types/jwt.types';

describe('AccessTokenStrategy', () => {
  let strategy: AccessTokenStrategy;
  let authRepository: { findUserById: jest.Mock };

  beforeEach(() => {
    authRepository = {
      findUserById: jest.fn(),
    };
    strategy = new AccessTokenStrategy(authRepository as unknown as AuthRepository);
  });

  it('hydrates fresh role, email, and permissions from DB over stale JWT claims', async () => {
    const stalePayload: JwtPayload = {
      sub: 'user-1',
      email: 'old@timmbr.com',
      role: UserRole.ADMIN,
      permissions: [],
    };

    authRepository.findUserById.mockResolvedValue({
      id: 'user-1',
      email: 'slims2854+admin@gmail.com',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      permissions: ['orders:read', 'transactions:read', 'catalog:read'],
    });

    const result = await strategy.validate(stalePayload);

    expect(authRepository.findUserById).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      sub: 'user-1',
      email: 'slims2854+admin@gmail.com',
      role: UserRole.ADMIN,
      permissions: ['orders:read', 'transactions:read', 'catalog:read'],
    });
  });

  it('throws UserDeactivatedException when user status is DELETED', async () => {
    authRepository.findUserById.mockResolvedValue({
      id: 'user-1',
      email: 'slims2854+admin@gmail.com',
      role: UserRole.ADMIN,
      status: UserStatus.DELETED,
      permissions: ['orders:read'],
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'slims2854+admin@gmail.com',
        role: UserRole.ADMIN,
        permissions: ['orders:read'],
      }),
    ).rejects.toThrow(UserDeactivatedException);
  });

  it('falls back to original payload when user record is missing', async () => {
    const payload: JwtPayload = {
      sub: 'missing-id',
      email: 'test@timmbr.com',
      role: UserRole.ADMIN,
      permissions: ['orders:read'],
    };
    authRepository.findUserById.mockResolvedValue(null);

    await expect(strategy.validate(payload)).resolves.toEqual(payload);
  });
});
