import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@/mailer/mailer.service';
import { RedisService } from '@/redis/redis.service';
import { UserRole, UserStatus } from '@prisma/client';
import { User } from '@/common/types/user';
import { TokenRevokedException } from '@/common/exceptions/token.exception';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { LoginPayloadDto } from './dto/login-dto';
import { SignUpPayloadDto } from './dto/sign-up-dto';
import { TokenType } from './types/token-type.enum';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));
import * as argon2 from 'argon2';
const mockedArgon2 = jest.mocked(argon2);

const USER_ID = 'user-id-1';
const USER_EMAIL = 'test@example.com';
const USER_NAME = 'Test User';

const baseUser: User = {
  id: USER_ID,
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  name: USER_NAME,
  email: USER_EMAIL,
  phone: null,
  emailVerified: false,
  password: 'hashed-password',
  lastLoginAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockJwtService: Partial<JwtService> = {
  signAsync: jest.fn(),
};

const mockAuthRepository = {
  findUserByEmail: jest.fn(),
  findUserByEmailWithProviders: jest.fn(),
  findUserById: jest.fn(),
  findUserByIdWithProviders: jest.fn(),
  findUserByIdOrThrow: jest.fn(),
  createEmailUser: jest.fn(),
  createOAuthUserAndProvider: jest.fn(),
  upsertUserProvider: jest.fn(),
  updateUser: jest.fn(),
  updateLastLoginAt: jest.fn(),
  updateEmailVerified: jest.fn(),
};

const mockRedisService = {
  setWithTTL: jest.fn(),
  getAndDelete: jest.fn(),
  delete: jest.fn(),
  get: jest.fn(),
  incrementWithExpiry: jest.fn(),
};

const mockMailerService = {
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: RedisService, useValue: mockRedisService },
        { provide: MailerService, useValue: mockMailerService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── generateJwtTokens ──────────────────────────────────────────────────────

  describe('generateJwtTokens', () => {
    it('returns accessToken and refreshToken', async () => {
      (mockJwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.generateJwtTokens(baseUser);

      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });

  // ─── findUserByEmail ─────────────────────────────────────────────────────────

  describe('findUserByEmail', () => {
    it('returns user when found', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(baseUser);
      expect(await service.findUserByEmail(USER_EMAIL)).toBe(baseUser);
    });

    it('returns null when not found', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);
      expect(await service.findUserByEmail('unknown@example.com')).toBeNull();
    });
  });

  // ─── findUserById ────────────────────────────────────────────────────────────

  describe('findUserById', () => {
    it('returns user when found', async () => {
      mockAuthRepository.findUserById.mockResolvedValue(baseUser);
      expect(await service.findUserById(USER_ID)).toBe(baseUser);
    });

    it('returns null when not found', async () => {
      mockAuthRepository.findUserById.mockResolvedValue(null);
      expect(await service.findUserById('nonexistent-id')).toBeNull();
    });
  });

  // ─── signup ──────────────────────────────────────────────────────────────────

  describe('signup', () => {
    const dto: SignUpPayloadDto = { name: USER_NAME, email: USER_EMAIL, password: 'Password1!' };

    it('creates new user, sends verification email, and returns sign-up response', async () => {
      const createdUser = { ...baseUser, providers: [] };
      mockAuthRepository.findUserByEmailWithProviders.mockResolvedValue(null);
      mockedArgon2.hash.mockResolvedValue('hashed');
      mockAuthRepository.createEmailUser.mockResolvedValue(createdUser);
      (mockJwtService.signAsync as jest.Mock).mockResolvedValue('token');
      mockRedisService.setWithTTL.mockResolvedValue(undefined);
      mockMailerService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await service.signup(dto);

      expect(mockAuthRepository.createEmailUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: USER_EMAIL, password: 'hashed' }),
      );
      expect(mockMailerService.sendVerificationEmail).toHaveBeenCalledWith(
        USER_EMAIL,
        USER_NAME,
        expect.stringContaining('verify-email?token='),
      );
      expect(result).toBeDefined();
    });

    it('throws ConflictException when email already exists with a password', async () => {
      const existingUser = { ...baseUser, password: 'existing-hash', providers: [] };
      mockAuthRepository.findUserByEmailWithProviders.mockResolvedValue(existingUser);

      await expect(service.signup(dto)).rejects.toThrow(ConflictException);
      expect(mockAuthRepository.createEmailUser).not.toHaveBeenCalled();
    });

    it('merges OAuth-only account by adding a password when user exists with no password', async () => {
      const oauthUser = { ...baseUser, password: null, providers: [{ type: 'GOOGLE' }] };
      const updatedUser = { ...baseUser, password: 'hashed', providers: [{ type: 'GOOGLE' }] };
      mockAuthRepository.findUserByEmailWithProviders.mockResolvedValue(oauthUser);
      mockedArgon2.hash.mockResolvedValue('hashed');
      mockAuthRepository.updateUser.mockResolvedValue(updatedUser);
      (mockJwtService.signAsync as jest.Mock).mockResolvedValue('token');
      mockRedisService.setWithTTL.mockResolvedValue(undefined);

      const result = await service.signup(dto);

      expect(mockAuthRepository.updateUser).toHaveBeenCalledWith(USER_ID, { password: 'hashed' });
      expect(mockAuthRepository.createEmailUser).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto: LoginPayloadDto = { email: USER_EMAIL, password: 'Password1!' };

    it('returns login response with valid credentials', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(baseUser);
      mockedArgon2.verify.mockResolvedValue(true);
      (mockJwtService.signAsync as jest.Mock).mockResolvedValue('token');
      mockRedisService.setWithTTL.mockResolvedValue(undefined);

      const result = await service.login(dto);

      expect(mockedArgon2.verify).toHaveBeenCalledWith(baseUser.password, dto.password);
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when user not found', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(baseUser);
      mockedArgon2.verify.mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── refreshTokens ───────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    const rawToken = 'raw-refresh-token';

    it('returns new tokens when stored userId matches', async () => {
      mockRedisService.getAndDelete.mockResolvedValue(USER_ID);
      mockAuthRepository.findUserById.mockResolvedValue(baseUser);
      (mockJwtService.signAsync as jest.Mock).mockResolvedValue('new-token');
      mockRedisService.setWithTTL.mockResolvedValue(undefined);

      const result = await service.refreshTokens(USER_ID, rawToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws TokenRevokedException when stored userId is null', async () => {
      mockRedisService.getAndDelete.mockResolvedValue(null);
      await expect(service.refreshTokens(USER_ID, rawToken)).rejects.toThrow(TokenRevokedException);
    });

    it('throws TokenRevokedException when stored userId does not match', async () => {
      mockRedisService.getAndDelete.mockResolvedValue('other-user-id');
      await expect(service.refreshTokens(USER_ID, rawToken)).rejects.toThrow(TokenRevokedException);
    });

    it('throws TokenRevokedException when user no longer exists', async () => {
      mockRedisService.getAndDelete.mockResolvedValue(USER_ID);
      mockAuthRepository.findUserById.mockResolvedValue(null);
      await expect(service.refreshTokens(USER_ID, rawToken)).rejects.toThrow(TokenRevokedException);
    });
  });

  // ─── revokeRefreshToken ──────────────────────────────────────────────────────

  describe('revokeRefreshToken', () => {
    it('calls redis.delete with the hashed token key', async () => {
      mockRedisService.delete.mockResolvedValue(undefined);
      await service.revokeRefreshToken('raw-token');
      expect(mockRedisService.delete).toHaveBeenCalledWith(expect.stringMatching(/^auth:refresh:/));
    });
  });

  // ─── verifyEmail ─────────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('marks emailVerified=true when token is valid', async () => {
      mockRedisService.getAndDelete.mockResolvedValue(USER_ID);
      mockAuthRepository.updateEmailVerified.mockResolvedValue(baseUser);

      await service.verifyEmail('valid-token');

      expect(mockAuthRepository.updateEmailVerified).toHaveBeenCalledWith(USER_ID);
    });

    it('throws UnauthorizedException when token is not found in Redis', async () => {
      mockRedisService.getAndDelete.mockResolvedValue(null);
      await expect(service.verifyEmail('expired-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── forgotPassword ──────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('stores reset token and sends reset email for a valid user with password', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(baseUser);
      mockRedisService.setWithTTL.mockResolvedValue(undefined);
      mockMailerService.sendPasswordResetEmail.mockResolvedValue(undefined);

      await service.forgotPassword(USER_EMAIL);

      expect(mockRedisService.setWithTTL).toHaveBeenCalledWith(
        expect.stringMatching(/^pwd:reset:/),
        900,
        USER_ID,
      );
      expect(mockMailerService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('returns silently when user is not found', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);
      await expect(service.forgotPassword('unknown@example.com')).resolves.toBeUndefined();
      expect(mockMailerService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('returns silently when user has no password (OAuth-only account)', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue({ ...baseUser, password: null });
      await expect(service.forgotPassword(USER_EMAIL)).resolves.toBeUndefined();
      expect(mockMailerService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  // ─── validateToken ───────────────────────────────────────────────────────────

  describe('validateToken', () => {
    it('resolves when token exists in Redis', async () => {
      mockRedisService.get.mockResolvedValue(USER_ID);
      await expect(
        service.validateToken('valid-token', TokenType.RESET_PASSWORD),
      ).resolves.toBeUndefined();
    });

    it('throws UnauthorizedException with TOKEN_INVALID code when token is missing', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const error = await service
        .validateToken('expired-token', TokenType.RESET_PASSWORD)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: 'TOKEN_INVALID',
      });
    });
  });

  // ─── resetPassword ───────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('resets the password successfully', async () => {
      mockRedisService.getAndDelete.mockResolvedValue(USER_ID);
      mockAuthRepository.findUserById.mockResolvedValue(baseUser);
      mockedArgon2.verify.mockResolvedValue(false);
      mockedArgon2.hash.mockResolvedValue('new-hashed');
      mockAuthRepository.updateUser.mockResolvedValue(baseUser);

      await expect(service.resetPassword('valid-token', 'NewPassword1!')).resolves.toBeUndefined();

      expect(mockAuthRepository.updateUser).toHaveBeenCalledWith(USER_ID, {
        password: 'new-hashed',
      });
    });

    it('throws UnauthorizedException (TOKEN_INVALID) when token is invalid', async () => {
      mockRedisService.getAndDelete.mockResolvedValue(null);

      const error = await service
        .resetPassword('bad-token', 'NewPassword1!')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: 'TOKEN_INVALID',
      });
    });

    it('throws NotFoundException when user is not found', async () => {
      mockRedisService.getAndDelete.mockResolvedValue(USER_ID);
      mockAuthRepository.findUserById.mockResolvedValue(null);
      await expect(service.resetPassword('valid-token', 'NewPassword1!')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnauthorizedException (NO_PASSWORD_ACCOUNT) when user has no password', async () => {
      mockRedisService.getAndDelete.mockResolvedValue(USER_ID);
      mockAuthRepository.findUserById.mockResolvedValue({ ...baseUser, password: null });

      const error = await service
        .resetPassword('valid-token', 'NewPassword1!')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: 'NO_PASSWORD_ACCOUNT',
      });
    });

    it('throws BadRequestException when new password is the same as the current password', async () => {
      mockRedisService.getAndDelete.mockResolvedValue(USER_ID);
      mockAuthRepository.findUserById.mockResolvedValue(baseUser);
      mockedArgon2.verify.mockResolvedValue(true);

      await expect(service.resetPassword('valid-token', 'SamePassword1!')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── changePassword ──────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('changes password and stores change timestamp in Redis', async () => {
      mockAuthRepository.findUserById.mockResolvedValue(baseUser);
      mockedArgon2.verify.mockResolvedValue(true);
      mockedArgon2.hash.mockResolvedValue('new-hashed');
      mockAuthRepository.updateUser.mockResolvedValue(baseUser);
      mockRedisService.setWithTTL.mockResolvedValue(undefined);

      await expect(
        service.changePassword(USER_ID, 'OldPassword1!', 'NewPassword1!'),
      ).resolves.toBeUndefined();

      expect(mockAuthRepository.updateUser).toHaveBeenCalledWith(USER_ID, {
        password: 'new-hashed',
      });
      expect(mockRedisService.setWithTTL).toHaveBeenCalledWith(
        `pwd:change:${USER_ID}`,
        1_209_600,
        expect.any(String),
      );
    });

    it('throws BadRequestException immediately when old and new passwords are the same', async () => {
      await expect(service.changePassword(USER_ID, 'same', 'same')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockAuthRepository.findUserById).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when user is not found', async () => {
      mockAuthRepository.findUserById.mockResolvedValue(null);
      await expect(service.changePassword(USER_ID, 'OldPass1!', 'NewPass1!')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnauthorizedException (NO_PASSWORD_ACCOUNT) when user has no password', async () => {
      mockAuthRepository.findUserById.mockResolvedValue({ ...baseUser, password: null });

      const error = await service
        .changePassword(USER_ID, 'OldPass1!', 'NewPass1!')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: 'NO_PASSWORD_ACCOUNT',
      });
    });

    it('throws UnauthorizedException when old password is incorrect', async () => {
      mockAuthRepository.findUserById.mockResolvedValue(baseUser);
      mockedArgon2.verify.mockResolvedValue(false);
      await expect(service.changePassword(USER_ID, 'WrongOld1!', 'NewPass1!')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── resendVerificationEmail ─────────────────────────────────────────────────

  describe('resendVerificationEmail', () => {
    it('sends verification email and returns correct attemptsLeft', async () => {
      mockAuthRepository.findUserById.mockResolvedValue({ ...baseUser, emailVerified: false });
      mockRedisService.incrementWithExpiry.mockResolvedValue(1);
      mockRedisService.setWithTTL.mockResolvedValue(undefined);
      mockMailerService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await service.resendVerificationEmail(USER_ID);

      expect(result).toEqual({ attemptsLeft: 2 });
      expect(mockMailerService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('throws NotFoundException when user is not found', async () => {
      mockAuthRepository.findUserById.mockResolvedValue(null);
      await expect(service.resendVerificationEmail(USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when email is already verified', async () => {
      mockAuthRepository.findUserById.mockResolvedValue({ ...baseUser, emailVerified: true });
      await expect(service.resendVerificationEmail(USER_ID)).rejects.toThrow(ConflictException);
    });

    it('throws 429 HttpException when resend count exceeds max attempts', async () => {
      mockAuthRepository.findUserById.mockResolvedValue({ ...baseUser, emailVerified: false });
      mockRedisService.incrementWithExpiry.mockResolvedValue(4);

      const error = await service.resendVerificationEmail(USER_ID).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });
});
