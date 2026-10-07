import { fakeJwt } from '@/common/testing/fake-jwt';
import { Test, TestingModule } from '@nestjs/testing';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { appUrls } from '@/config/env';
import { Application } from '@/common/types/application.types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ValidateTokenDto,
} from './dto/password.dto';
import { LoginPayloadDto } from './dto/login-dto';
import { TokenType } from './types/token-type.enum';
import { OAUTH_BIND_COOKIE, OAUTH_STATE_COOKIE } from './auth.constants';

const RT = fakeJwt(7 * 86400);

const mockAuthService = {
  login: jest.fn(),
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
  setPassword: jest.fn(),
  refreshTokens: jest.fn(),
  revokeRefreshToken: jest.fn(),
  createOAuthExchangeCode: jest.fn(),
  exchangeOAuthCode: jest.fn(),
  revokeAllSessions: jest.fn(),
  forgotPassword: jest.fn(),
  validateToken: jest.fn(),
  resetPassword: jest.fn(),
  changePassword: jest.fn(),
};

const mockReq = (overrides: Record<string, unknown> = {}) =>
  ({
    user: { sub: 'user-id-1', email: 'test@example.com', role: 'USER' },
    cookies: {},
    query: {},
    ...overrides,
  }) as unknown as FastifyRequest;

const mockReply = () =>
  ({
    setCookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn().mockResolvedValue(undefined),
  }) as unknown as FastifyReply;

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => jest.resetAllMocks());

  // ─── sign-in ─────────────────────────────────────────────────────────────────

  it('login passes the dto and application through', async () => {
    const dto: LoginPayloadDto = { identifier: 'test@example.com', password: 'pw' };
    mockAuthService.login.mockResolvedValue({ id: '1' });

    await controller.login(dto, Application.ADMIN_CONSOLE);

    expect(mockAuthService.login).toHaveBeenCalledWith(dto, Application.ADMIN_CONSOLE);
  });

  it('verifyOtp passes application and intent', async () => {
    await controller.verifyOtp(
      { identifier: 'a@b.co', code: '123456', intent: 'reset' },
      Application.STOREFRONT,
    );

    expect(mockAuthService.verifyOtp).toHaveBeenCalledWith('a@b.co', '123456', {
      application: Application.STOREFRONT,
      intent: 'reset',
    });
  });

  it('setPassword uses the authenticated user', async () => {
    await controller.setPassword(mockReq(), { token: 't', password: 'Str0ng!pw' });

    expect(mockAuthService.setPassword).toHaveBeenCalledWith('user-id-1', 't', 'Str0ng!pw');
  });

  // ─── session ─────────────────────────────────────────────────────────────────

  it('refresh rotates into the per-app cookie', async () => {
    mockAuthService.refreshTokens.mockResolvedValue({ accessToken: 'at', refreshToken: RT });
    const reply = mockReply();
    const req = mockReq({
      application: Application.ADMIN_CONSOLE,
      user: { sub: 'user-id-1', refreshToken: 'old' },
    });

    await expect(controller.refresh(req, reply)).resolves.toEqual({ accessToken: 'at' });
    expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('user-id-1', 'old');
    expect(reply.setCookie).toHaveBeenCalledWith(
      'rt_admin',
      RT,
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );
  });

  it('logout revokes the storefront cookie and clears it', async () => {
    const reply = mockReply();

    await controller.logout(mockReq({ cookies: { rt_sf: 'rt' } }), reply);

    expect(mockAuthService.revokeRefreshToken).toHaveBeenCalledWith('rt');
    expect(reply.clearCookie).toHaveBeenCalledWith('rt_sf', { path: '/api/v1/auth' });
  });

  it('logoutAll revokes every session for the user', async () => {
    await controller.logoutAll(mockReq(), mockReply());

    expect(mockAuthService.revokeAllSessions).toHaveBeenCalledWith('user-id-1');
  });

  describe('trusted clients (storefront BFF)', () => {
    it('refresh returns both tokens in the body and sets no cookie', async () => {
      mockAuthService.refreshTokens.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });
      const reply = mockReply();
      const req = mockReq({ trustedClient: true, user: { sub: 'user-id-1', refreshToken: 'old' } });

      await expect(controller.refresh(req, reply)).resolves.toEqual({
        accessToken: 'at',
        refreshToken: 'rt',
      });
      expect(reply.setCookie).not.toHaveBeenCalled();
    });

    it('logout revokes the refresh token from the body and sets no cookie', async () => {
      const reply = mockReply();

      await controller.logout(
        mockReq({ trustedClient: true, body: { refreshToken: 'rt' } }),
        reply,
      );

      expect(mockAuthService.revokeRefreshToken).toHaveBeenCalledWith('rt');
      expect(reply.clearCookie).not.toHaveBeenCalled();
    });

    it('logoutAll revokes every session and sets no cookie', async () => {
      const reply = mockReply();

      await controller.logoutAll(mockReq({ trustedClient: true }), reply);

      expect(mockAuthService.revokeAllSessions).toHaveBeenCalledWith('user-id-1');
      expect(reply.clearCookie).not.toHaveBeenCalled();
    });

    it('oauthExchange swaps the code for the session', async () => {
      mockAuthService.exchangeOAuthCode.mockResolvedValue({ id: 'u1', refreshToken: 'rt' });

      await expect(controller.oauthExchange({ code: 'c', bind: 'b' })).resolves.toMatchObject({
        id: 'u1',
      });
      expect(mockAuthService.exchangeOAuthCode).toHaveBeenCalledWith('c', 'b');
    });
  });

  // ─── passwords ───────────────────────────────────────────────────────────────

  it('forgotPassword passes the email', async () => {
    const dto: ForgotPasswordDto = { email: 'test@example.com' };
    await controller.forgotPassword(dto);
    expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('test@example.com');
  });

  it('validateToken passes token and type', async () => {
    const dto: ValidateTokenDto = { token: 'abc', type: TokenType.RESET_PASSWORD };
    await controller.validateToken(dto);
    expect(mockAuthService.validateToken).toHaveBeenCalledWith('abc', TokenType.RESET_PASSWORD);
  });

  it('resetPassword passes token and new password', async () => {
    const dto: ResetPasswordDto = { token: 'tkn', newPassword: 'NewPass1!' };
    await controller.resetPassword(dto);
    expect(mockAuthService.resetPassword).toHaveBeenCalledWith('tkn', 'NewPass1!');
  });

  it('changePassword uses the authenticated user', async () => {
    const dto: ChangePasswordDto = { oldPassword: 'Old1!', newPassword: 'New1!' };
    await controller.changePassword(mockReq(), dto);
    expect(mockAuthService.changePassword).toHaveBeenCalledWith('user-id-1', 'Old1!', 'New1!');
  });

  // ─── Google OAuth callback ───────────────────────────────────────────────────

  describe('googleCallback (GET /auth/google/callback)', () => {
    const BIND_HASH = 'a'.repeat(64);
    const withState = (cookie?: string, query?: string) =>
      mockReq({
        cookies: cookie ? { [OAUTH_STATE_COOKIE]: cookie, [OAUTH_BIND_COOKIE]: BIND_HASH } : {},
        query: query ? { state: query } : {},
      });

    it('redirects to the storefront BFF with a single-use code (no token, no cookie)', async () => {
      jest.spyOn(controller as any, 'authenticateGoogle').mockResolvedValue({
        user: { id: 'u1' },
        tokens: { accessToken: 'secret-at', refreshToken: 'secret-rt' },
      });
      mockAuthService.createOAuthExchangeCode.mockResolvedValue('one-time code');
      const reply = mockReply();

      await controller.googleCallback(withState('nonce', 'nonce'), reply);

      expect(reply.setCookie).not.toHaveBeenCalled();
      expect(mockAuthService.createOAuthExchangeCode).toHaveBeenCalledWith(
        expect.objectContaining({ user: { id: 'u1' } }),
        BIND_HASH,
      );
      expect(reply.redirect).toHaveBeenCalledWith(
        `${appUrls.storefront}/api/auth/oauth/callback?code=one-time%20code`,
        302,
      );
      const url = (reply.redirect as jest.Mock).mock.calls[0][0] as string;
      expect(url).not.toContain('secret');
    });

    it.each([
      ['missing state cookie', undefined, 'nonce'],
      ['missing state param', 'nonce', undefined],
      ['mismatched state', 'nonce', 'other'],
    ])('rejects a %s (login CSRF)', async (_label, cookie, query) => {
      const authenticate = jest.spyOn(controller as any, 'authenticateGoogle');
      const reply = mockReply();

      await controller.googleCallback(withState(cookie, query), reply);

      expect(authenticate).not.toHaveBeenCalled();
      expect(reply.setCookie).not.toHaveBeenCalled();
      expect(reply.redirect).toHaveBeenCalledWith(
        `${appUrls.storefront}/oauth/callback?status=error`,
        302,
      );
    });

    it('redirects with status=error when authentication fails', async () => {
      jest
        .spyOn(controller as any, 'authenticateGoogle')
        .mockRejectedValue(new Error('access_denied'));
      const reply = mockReply();

      await controller.googleCallback(withState('nonce', 'nonce'), reply);

      expect(reply.setCookie).not.toHaveBeenCalled();
      expect(reply.redirect).toHaveBeenCalledWith(
        `${appUrls.storefront}/oauth/callback?status=error`,
        302,
      );
    });

    it('redirects with status=error when the exchange code cannot be stored (e.g. Redis down)', async () => {
      jest.spyOn(controller as any, 'authenticateGoogle').mockResolvedValue({
        user: { id: 'u1' },
        tokens: { accessToken: 'at', refreshToken: 'rt' },
      });
      mockAuthService.createOAuthExchangeCode.mockRejectedValue(new Error('redis down'));
      const reply = mockReply();

      await controller.googleCallback(withState('nonce', 'nonce'), reply);

      expect(reply.redirect).toHaveBeenCalledTimes(1);
      expect(reply.redirect).toHaveBeenCalledWith(
        `${appUrls.storefront}/oauth/callback?status=error`,
        302,
      );
    });

    it('fails without the storefront binding cookie', async () => {
      const authenticate = jest.spyOn(controller as any, 'authenticateGoogle');
      const reply = mockReply();
      const req = mockReq({
        cookies: { [OAUTH_STATE_COOKIE]: 'nonce' },
        query: { state: 'nonce' },
      });

      await controller.googleCallback(req, reply);

      expect(authenticate).not.toHaveBeenCalled();
      expect(reply.redirect).toHaveBeenCalledWith(
        `${appUrls.storefront}/oauth/callback?status=error`,
        302,
      );
    });

    it('refuses to start sign-in without a valid bind hash', () => {
      const reply = {
        redirect: jest.fn().mockResolvedValue(undefined),
        hijack: jest.fn(),
      } as unknown as FastifyReply;

      controller.googleAuth(mockReq({ query: { bind: 'not-a-hash' } }), reply);

      expect(reply.redirect).toHaveBeenCalledWith(
        `${appUrls.storefront}/oauth/callback?status=error`,
        302,
      );
      expect((reply as any).hijack).not.toHaveBeenCalled();
    });

    it('always clears the one-time state cookie', async () => {
      const reply = mockReply();

      await controller.googleCallback(withState('nonce', 'other'), reply);

      expect(reply.clearCookie).toHaveBeenCalledWith(OAUTH_STATE_COOKIE, {
        path: '/api/v1/auth/google',
      });
    });
  });
});
