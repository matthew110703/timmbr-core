import { Test, TestingModule } from '@nestjs/testing';
import type { FastifyRequest } from 'fastify';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ValidateTokenDto,
} from './dto/password.dto';
import { LoginPayloadDto } from './dto/login-dto';
import { SignUpPayloadDto } from './dto/sign-up-dto';
import { TokenType } from './types/token-type.enum';

const mockAuthService: Partial<AuthService> = {
  signup: jest.fn(),
  login: jest.fn(),
  refreshTokens: jest.fn(),
  revokeRefreshToken: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerificationEmail: jest.fn(),
  forgotPassword: jest.fn(),
  validateToken: jest.fn(),
  resetPassword: jest.fn(),
  changePassword: jest.fn(),
};

const mockReq = (overrides: Record<string, unknown> = {}) =>
  ({
    user: { sub: 'user-id-1', email: 'test@example.com', role: 'USER' },
    cookies: {},
    ...overrides,
  }) as unknown as FastifyRequest;

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── signup ──────────────────────────────────────────────────────────────────

  describe('create (POST /auth/signup)', () => {
    it('calls auth.signup with the dto and returns the result', async () => {
      const dto: SignUpPayloadDto = { name: 'Test', email: 'test@example.com', password: 'Pass1!' };
      const expected = { user: { id: '1' }, tokens: { accessToken: 'at' } };
      (mockAuthService.signup as jest.Mock).mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(mockAuthService.signup).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────────

  describe('login (POST /auth/login)', () => {
    it('calls auth.login with the dto and returns the result', async () => {
      const dto: LoginPayloadDto = { email: 'test@example.com', password: 'Pass1!' };
      const expected = { user: { id: '1' }, accessToken: 'at' };
      (mockAuthService.login as jest.Mock).mockResolvedValue(expected);

      const result = await controller.login(dto);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto, undefined);
      expect(result).toBe(expected);
    });
  });

  // ─── verifyEmail ─────────────────────────────────────────────────────────────

  describe('verifyEmail (GET /auth/verify-email)', () => {
    it('calls auth.verifyEmail with the token', async () => {
      (mockAuthService.verifyEmail as jest.Mock).mockResolvedValue(undefined);

      await controller.verifyEmail('test-token');

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('test-token');
    });
  });

  // ─── resendVerification ──────────────────────────────────────────────────────

  describe('resendVerification (POST /auth/resend-verification)', () => {
    it('calls auth.resendVerificationEmail with the user id from the request', async () => {
      const expected = { attemptsLeft: 2 };
      (mockAuthService.resendVerificationEmail as jest.Mock).mockResolvedValue(expected);

      const result = await controller.resendVerification(mockReq());

      expect(mockAuthService.resendVerificationEmail).toHaveBeenCalledWith('user-id-1');
      expect(result).toBe(expected);
    });
  });

  // ─── forgotPassword ──────────────────────────────────────────────────────────

  describe('forgotPassword (POST /auth/forgot-password)', () => {
    it('calls auth.forgotPassword with the email', async () => {
      (mockAuthService.forgotPassword as jest.Mock).mockResolvedValue(undefined);
      const dto: ForgotPasswordDto = { email: 'test@example.com' };

      await controller.forgotPassword(dto);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('test@example.com');
    });
  });

  // ─── validateToken ───────────────────────────────────────────────────────────

  describe('validateToken (GET /auth/validate-token)', () => {
    it('calls auth.validateToken with token and type', async () => {
      (mockAuthService.validateToken as jest.Mock).mockResolvedValue(undefined);
      const dto: ValidateTokenDto = { token: 'abc', type: TokenType.RESET_PASSWORD };

      await controller.validateToken(dto);

      expect(mockAuthService.validateToken).toHaveBeenCalledWith('abc', TokenType.RESET_PASSWORD);
    });
  });

  // ─── resetPassword ───────────────────────────────────────────────────────────

  describe('resetPassword (POST /auth/reset-password)', () => {
    it('calls auth.resetPassword with token and newPassword', async () => {
      (mockAuthService.resetPassword as jest.Mock).mockResolvedValue(undefined);
      const dto: ResetPasswordDto = { token: 'tkn', newPassword: 'NewPass1!' };

      await controller.resetPassword(dto);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith('tkn', 'NewPass1!');
    });
  });

  // ─── changePassword ──────────────────────────────────────────────────────────

  describe('changePassword (POST /auth/change-password)', () => {
    it('calls auth.changePassword with userId, oldPassword, and newPassword', async () => {
      (mockAuthService.changePassword as jest.Mock).mockResolvedValue(undefined);
      const dto: ChangePasswordDto = { oldPassword: 'Old1!', newPassword: 'New1!' };

      await controller.changePassword(mockReq(), dto);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith('user-id-1', 'Old1!', 'New1!');
    });
  });
});
