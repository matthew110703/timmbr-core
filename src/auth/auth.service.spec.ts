import { createHash } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { OAuthType, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { RedisService } from '@/redis/redis.service';
import { MailerService } from '@/mailer/mailer.service';
import { Application } from '@/common/types/application.types';
import { TokenRevokedException } from '@/common/exceptions/token.exception';
import { UserDeactivatedException } from '@/common/exceptions/user.exception';
import {
  EmailNotVerifiedException,
  InvalidCredentialsException,
  OAuthNotAllowedForAdminException,
  OtpNotAllowedForAdminException,
  PasswordSetupTokenInvalidException,
} from '@/common/exceptions/auth.exception';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { OtpService } from './otp/otp.service';
import { TokenService } from './token/token.service';

jest.mock('argon2', () => ({ verify: jest.fn(), hash: jest.fn() }));

const repo = {
  findUserByEmail: jest.fn(),
  findUserByEmailWithProviders: jest.fn(),
  findUserByPhoneVariants: jest.fn(),
  findUserByProvider: jest.fn(),
  findUserById: jest.fn(),
  createEmailUser: jest.fn(),
  createOAuthUserAndProvider: jest.fn(),
  upsertUserProvider: jest.fn(),
  updateUser: jest.fn(),
};
const redis = { setWithTTL: jest.fn(), getAndDelete: jest.fn(), get: jest.fn() };
const mailer = { sendPasswordResetEmail: jest.fn() };
const otp = { send: jest.fn(), verify: jest.fn() };
const tokens = { issue: jest.fn(), rotate: jest.fn(), revoke: jest.fn(), revokeAll: jest.fn() };

const TOKENS = { accessToken: 'at', refreshToken: 'rt' };
const baseUser = {
  id: 'u1',
  name: 'Daenerys Targaryen',
  email: 'dany@example.com',
  phone: null,
  password: 'hash',
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  emailVerified: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  providers: [],
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repo },
        { provide: RedisService, useValue: redis },
        { provide: MailerService, useValue: mailer },
        { provide: OtpService, useValue: otp },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    service = module.get(AuthService);

    tokens.issue.mockResolvedValue(TOKENS);
    tokens.rotate.mockImplementation((_u: string, _t: string, issue: () => unknown) => issue());
    repo.updateUser.mockImplementation((_id, data) => Promise.resolve({ ...baseUser, ...data }));
    (argon2.hash as jest.Mock).mockResolvedValue('new-hash');
    mailer.sendPasswordResetEmail.mockResolvedValue(undefined);
  });

  afterEach(() => jest.resetAllMocks());

  // ─── login ───────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('accepts email or phone and returns a session', async () => {
      repo.findUserByPhoneVariants.mockResolvedValue(baseUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const session = await service.login({ identifier: '98765 43210', password: 'pw' });

      expect(repo.findUserByPhoneVariants).toHaveBeenCalledWith([
        '+919876543210',
        '919876543210',
        '9876543210',
      ]);
      expect(session).toMatchObject({ id: 'u1', accessToken: 'at', refreshToken: 'rt' });
      expect(repo.updateUser).toHaveBeenCalledWith('u1', { lastLoginAt: expect.any(Date) });
    });

    it('still accepts the legacy `email` field (Admin Console)', async () => {
      repo.findUserByEmailWithProviders.mockResolvedValue(baseUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.login({ email: 'Dany@Example.com', password: 'pw' });

      expect(repo.findUserByEmailWithProviders).toHaveBeenCalledWith('dany@example.com');
    });

    it.each([
      ['unknown user', null],
      ['no password', { ...baseUser, password: null }],
    ])('returns one generic error for %s', async (_label, user) => {
      repo.findUserByEmailWithProviders.mockResolvedValue(user);

      await expect(service.login({ identifier: 'a@b.co', password: 'pw' })).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it.each([
      ['an unknown account', null],
      ['an account without a password', { ...baseUser, password: null }],
    ])('still runs a password hash check for %s (no timing difference)', async (_label, user) => {
      repo.findUserByEmailWithProviders.mockResolvedValue(user);
      (argon2.hash as jest.Mock).mockResolvedValue('dummy-hash');
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.login({ identifier: 'a@b.co', password: 'pw' })).rejects.toThrow(
        InvalidCredentialsException,
      );
      expect(argon2.verify).toHaveBeenCalledWith(expect.any(String), 'pw');
    });

    it('returns the same generic error for a wrong password', async () => {
      repo.findUserByEmailWithProviders.mockResolvedValue(baseUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ identifier: 'a@b.co', password: 'pw' })).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it('requires a verified email', async () => {
      repo.findUserByEmailWithProviders.mockResolvedValue({ ...baseUser, emailVerified: false });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.login({ identifier: 'a@b.co', password: 'pw' })).rejects.toThrow(
        EmailNotVerifiedException,
      );
    });

    it('blocks customers from the Admin Console', async () => {
      repo.findUserByEmailWithProviders.mockResolvedValue(baseUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ identifier: 'a@b.co', password: 'pw' }, Application.ADMIN_CONSOLE),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── verifyOtp ───────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    const emailId = { type: 'email', value: 'dany@example.com' } as const;

    it('creates a new account and issues a password-setup token', async () => {
      otp.verify.mockResolvedValue(emailId);
      repo.findUserByEmailWithProviders.mockResolvedValue(null);
      repo.createEmailUser.mockResolvedValue({ ...baseUser, name: 'dany', password: null });

      const session = await service.verifyOtp('dany@example.com', '123456');

      expect(repo.createEmailUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'dany@example.com', emailVerified: true }),
      );
      expect(session).toMatchObject({ isNewUser: true, hasPassword: false });
      expect(session.passwordSetupToken).toEqual(expect.any(String));
      expect(redis.setWithTTL).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:pwdsetup:[0-9a-f]{64}$/),
        600,
        'u1',
      );
    });

    it('signs an existing user with a password in without a setup token', async () => {
      otp.verify.mockResolvedValue(emailId);
      repo.findUserByEmailWithProviders.mockResolvedValue(baseUser);

      const session = await service.verifyOtp('dany@example.com', '123456');

      expect(session).toMatchObject({ isNewUser: false, hasPassword: true });
      expect(session.passwordSetupToken).toBeUndefined();
    });

    it('issues a setup token for intent=reset even when a password exists', async () => {
      otp.verify.mockResolvedValue(emailId);
      repo.findUserByEmailWithProviders.mockResolvedValue(baseUser);

      const session = await service.verifyOtp('dany@example.com', '123456', { intent: 'reset' });

      expect(session.passwordSetupToken).toEqual(expect.any(String));
    });

    it('wipes a password from an unverified (pre-claimed) account and revokes its sessions', async () => {
      otp.verify.mockResolvedValue(emailId);
      repo.findUserByEmailWithProviders.mockResolvedValue({ ...baseUser, emailVerified: false });

      const session = await service.verifyOtp('dany@example.com', '123456');

      expect(tokens.revokeAll).toHaveBeenCalledWith('u1');
      expect(repo.updateUser).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ emailVerified: true, password: null }),
      );
      expect(session.hasPassword).toBe(false);
    });

    it('rejects deleted accounts', async () => {
      otp.verify.mockResolvedValue(emailId);
      repo.findUserByEmailWithProviders.mockResolvedValue({
        ...baseUser,
        status: UserStatus.DELETED,
      });

      await expect(service.verifyOtp('dany@example.com', '123456')).rejects.toThrow(
        UserDeactivatedException,
      );
    });

    it.each([UserRole.ADMIN, UserRole.MASTER])(
      'refuses %s accounts from any app (an inbox alone never yields an admin token)',
      async (role) => {
        otp.verify.mockResolvedValue(emailId);
        repo.findUserByEmailWithProviders.mockResolvedValue({ ...baseUser, role });

        // No application: a storefront or curl request without an Origin header
        await expect(service.verifyOtp('dany@example.com', '123456')).rejects.toThrow(
          OtpNotAllowedForAdminException,
        );
        expect(tokens.issue).not.toHaveBeenCalled();
      },
    );

    it('is not allowed for the Admin Console', async () => {
      await expect(
        service.verifyOtp('dany@example.com', '123456', {
          application: Application.ADMIN_CONSOLE,
        }),
      ).rejects.toThrow(OtpNotAllowedForAdminException);
      expect(otp.verify).not.toHaveBeenCalled();
    });
  });

  // ─── setPassword ─────────────────────────────────────────────────────────────

  describe('setPassword', () => {
    it('sets the password, revokes other sessions and returns a fresh one', async () => {
      redis.getAndDelete.mockResolvedValue('u1');
      repo.findUserById.mockResolvedValue({ ...baseUser, password: null });

      const session = await service.setPassword('u1', 'setup-token', 'Str0ng!pw');

      expect(repo.updateUser).toHaveBeenCalledWith('u1', { password: 'new-hash' });
      expect(tokens.revokeAll).toHaveBeenCalledWith('u1');
      expect(session).toMatchObject({ hasPassword: true, accessToken: 'at' });
    });

    it('rejects a token issued to another user', async () => {
      redis.getAndDelete.mockResolvedValue('someone-else');

      await expect(service.setPassword('u1', 't', 'Str0ng!pw')).rejects.toThrow(
        PasswordSetupTokenInvalidException,
      );
      expect(repo.updateUser).not.toHaveBeenCalled();
    });
  });

  // ─── OAuth ───────────────────────────────────────────────────────────────────

  describe('handleOAuthLogin', () => {
    it('finds the user by provider identity first', async () => {
      repo.findUserByProvider.mockResolvedValue({
        ...baseUser,
        providers: [{ type: OAuthType.GOOGLE }],
      });

      await service.handleOAuthLogin(OAuthType.GOOGLE, 'g1', 'Dany@Example.com', 'Google Name');

      expect(repo.findUserByEmailWithProviders).not.toHaveBeenCalled();
      expect(repo.upsertUserProvider).not.toHaveBeenCalled();
    });

    it("doesn't overwrite a name the user chose", async () => {
      repo.findUserByProvider.mockResolvedValue({
        ...baseUser,
        providers: [{ type: OAuthType.GOOGLE }],
      });

      await service.handleOAuthLogin(OAuthType.GOOGLE, 'g1', 'dany@example.com', 'Google Name');

      expect(repo.updateUser).toHaveBeenCalledWith('u1', { lastLoginAt: expect.any(Date) });
    });

    it('links Google to an existing email account and claims it if unverified', async () => {
      repo.findUserByProvider.mockResolvedValue(null);
      repo.findUserByEmailWithProviders.mockResolvedValue({ ...baseUser, emailVerified: false });

      await service.handleOAuthLogin(OAuthType.GOOGLE, 'g1', 'dany@example.com', 'Dany');

      expect(repo.upsertUserProvider).toHaveBeenCalledWith('u1', OAuthType.GOOGLE, 'g1');
      expect(tokens.revokeAll).toHaveBeenCalledWith('u1');
      expect(repo.updateUser).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ emailVerified: true, password: null }),
      );
    });

    it('creates a new account with a lowercased email', async () => {
      repo.findUserByProvider.mockResolvedValue(null);
      repo.findUserByEmailWithProviders.mockResolvedValue(null);
      repo.createOAuthUserAndProvider.mockResolvedValue(baseUser);

      await service.handleOAuthLogin(OAuthType.GOOGLE, 'g1', 'Dany@Example.com', 'Dany');

      expect(repo.createOAuthUserAndProvider).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'dany@example.com', emailVerified: true }),
        OAuthType.GOOGLE,
        'g1',
      );
    });

    it.each([UserRole.ADMIN, UserRole.MASTER])(
      'refuses %s accounts (a Google account alone never yields an admin token)',
      async (role) => {
        repo.findUserByProvider.mockResolvedValue(null);
        repo.findUserByEmailWithProviders.mockResolvedValue({ ...baseUser, role });

        await expect(
          service.handleOAuthLogin(OAuthType.GOOGLE, 'g1', 'dany@example.com', 'Dany'),
        ).rejects.toThrow(OAuthNotAllowedForAdminException);
        expect(repo.upsertUserProvider).not.toHaveBeenCalled();
        expect(tokens.issue).not.toHaveBeenCalled();
      },
    );

    it('rejects deleted accounts', async () => {
      repo.findUserByProvider.mockResolvedValue({ ...baseUser, status: UserStatus.DELETED });

      await expect(
        service.handleOAuthLogin(OAuthType.GOOGLE, 'g1', 'dany@example.com', 'Dany'),
      ).rejects.toThrow(UserDeactivatedException);
    });
  });

  // ─── sessions & passwords ────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    it('rotates the token for an active user', async () => {
      repo.findUserById.mockResolvedValue(baseUser);

      await expect(service.refreshTokens('u1', 'rt')).resolves.toEqual(TOKENS);
      expect(tokens.rotate).toHaveBeenCalledWith('u1', 'rt', expect.any(Function));
    });

    it('revokes everything for a deleted user', async () => {
      repo.findUserById.mockResolvedValue({ ...baseUser, status: UserStatus.DELETED });

      await expect(service.refreshTokens('u1', 'rt')).rejects.toThrow(TokenRevokedException);
      expect(tokens.revokeAll).toHaveBeenCalledWith('u1');
    });
  });

  describe('OAuth exchange codes', () => {
    const BIND = 'storefront-nonce';
    const BIND_HASH = createHash('sha256').update(BIND).digest('hex');

    it('parks the session behind a single-use code (no token in the code)', async () => {
      const code = await service.createOAuthExchangeCode(
        { user: baseUser, tokens: TOKENS },
        BIND_HASH,
      );

      expect(code).toMatch(/^[A-Za-z0-9_-]{40,}$/);
      expect(code).not.toContain(TOKENS.accessToken);
      expect(redis.setWithTTL).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:oauth:code:[0-9a-f]{64}$/),
        60,
        expect.stringContaining(BIND_HASH),
      );
    });

    const record = JSON.stringify({
      session: { id: 'u1', refreshToken: 'rt' },
      bindHash: BIND_HASH,
    });

    it('exchanges a code once, for the browser holding the bind nonce', async () => {
      redis.getAndDelete.mockResolvedValueOnce(record).mockResolvedValueOnce(null);

      await expect(service.exchangeOAuthCode('code', BIND)).resolves.toMatchObject({ id: 'u1' });
      await expect(service.exchangeOAuthCode('code', BIND)).rejects.toMatchObject({
        response: { code: 'OAUTH_CODE_INVALID' },
      });
    });

    it("rejects a valid code presented with another browser's nonce (login CSRF)", async () => {
      redis.getAndDelete.mockResolvedValueOnce(record);

      await expect(service.exchangeOAuthCode('code', 'attacker-nonce')).rejects.toMatchObject({
        response: { code: 'OAUTH_CODE_INVALID' },
      });
    });
  });

  describe('changePassword', () => {
    it('revokes all sessions after a change', async () => {
      repo.findUserById.mockResolvedValue(baseUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.changePassword('u1', 'Old1!pass', 'New1!pass');

      expect(tokens.revokeAll).toHaveBeenCalledWith('u1');
    });
  });

  describe('resetPassword', () => {
    it('revokes all sessions after a reset', async () => {
      redis.getAndDelete.mockResolvedValue('u1');
      repo.findUserById.mockResolvedValue(baseUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await service.resetPassword('reset-token', 'New1!pass');

      expect(tokens.revokeAll).toHaveBeenCalledWith('u1');
    });
  });

  describe('forgotPassword', () => {
    it('links to the Admin Console (first ADMIN_CONSOLE_ORIGIN)', async () => {
      repo.findUserByEmail.mockResolvedValue(baseUser);

      await service.forgotPassword('dany@example.com');

      expect(mailer.sendPasswordResetEmail).toHaveBeenCalledWith(
        'dany@example.com',
        'Daenerys Targaryen',
        expect.stringMatching(/^http:\/\/localhost:5000\/reset-password\?token=[0-9a-f]{64}$/),
      );
    });

    it("doesn't wait for the email (response time can't reveal registered emails)", async () => {
      repo.findUserByEmail.mockResolvedValue(baseUser);
      mailer.sendPasswordResetEmail.mockReturnValue(new Promise(() => {})); // never settles

      await expect(service.forgotPassword('dany@example.com')).resolves.toBeUndefined();
    });

    it('still answers normally when the email provider fails', async () => {
      repo.findUserByEmail.mockResolvedValue(baseUser);
      mailer.sendPasswordResetEmail.mockRejectedValue(new Error('provider down'));

      await expect(service.forgotPassword('dany@example.com')).resolves.toBeUndefined();
    });
  });
});
