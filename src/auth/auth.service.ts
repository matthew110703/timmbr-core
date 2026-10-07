import { appUrls } from '@/config/env';
import { RedisService } from '@/redis/redis.service';
import { MailerService } from '@/mailer/mailer.service';
import { User, UserWithProviders } from '@/common/types/user';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuthType, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { Application } from '@/common/types/application.types';
import { TokenRevokedException } from '@/common/exceptions/token.exception';
import { UserDeactivatedException } from '@/common/exceptions/user.exception';
import {
  EmailNotVerifiedException,
  InvalidCredentialsException,
  InvalidIdentifierException,
  OAuthNotAllowedForAdminException,
  OtpNotAllowedForAdminException,
  PasswordSetupTokenInvalidException,
} from '@/common/exceptions/auth.exception';
import { AuthRepository } from './auth.repository';
import { AuthMapper, AuthSession } from './auth.mapper';
import { OtpService } from './otp/otp.service';
import { TokenPair, TokenService } from './token/token.service';
import { TokenType } from './types/token-type.enum';
import { LoginPayloadDto } from './dto/login-dto';
import {
  OAUTH_EXCHANGE_CODE_TTL_S,
  OtpIntent,
  PASSWORD_RESET_TTL_S,
  PASSWORD_SETUP_TTL_S,
} from './auth.constants';
import {
  Identifier,
  legacyPhoneVariants,
  normalizeEmail,
  normalizeIdentifier,
} from './utils/identifier.util';

interface OAuthExchangeRecord {
  session: AuthSession;
  /** sha256 (hex) of the storefront's binding nonce. */
  bindHash: string;
}

export interface OAuthLoginResult {
  user: UserWithProviders;
  tokens: TokenPair;
}

/** Placeholder for phone-only accounts until the email column becomes optional. */
const phonePlaceholderEmail = (e164: string) => `${e164.slice(1)}@phone.timmbr.com`;

/** Roles that can use the Admin Console API. They must always sign in with their password. */
const isAdminRole = (role: UserRole) => role === UserRole.ADMIN || role === UserRole.MASTER;

/**
 * Hash of a random password, verified against when the account doesn't exist
 * (or has no password) so a failed login takes the same time either way and
 * can't be used to discover which accounts exist.
 */
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= argon2.hash(crypto.randomBytes(32).toString('hex')));

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly redis: RedisService,
    private readonly mailer: MailerService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  // ─── Password login ──────────────────────────────────────────────────────────

  async login(payload: LoginPayloadDto, application?: Application): Promise<AuthSession> {
    const id = normalizeIdentifier(payload.identifier ?? payload.email ?? '');
    if (!id) throw new InvalidIdentifierException();

    const user = await this.findUserByIdentifier(id);

    // One generic error (and the same hashing time) for unknown user / no
    // password / wrong password, so login can't reveal which accounts exist.
    const isPasswordValid = await argon2.verify(
      user?.password ?? (await getDummyHash()),
      payload.password,
    );
    if (!user?.password || !isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    this.assertActive(user);
    if (!user.emailVerified) throw new EmailNotVerifiedException();
    this.assertAllowedInApplication(user, application);

    const loggedIn = await this.authRepository.updateUser(user.id, { lastLoginAt: new Date() });
    const tokens = await this.tokens.issue(loggedIn);
    return AuthMapper.toSession(loggedIn, tokens);
  }

  // ─── One-time code login ─────────────────────────────────────────────────────

  sendOtp(identifier: string) {
    return this.otp.send(identifier);
  }

  async verifyOtp(
    identifier: string,
    code: string,
    { application, intent = 'login' }: { application?: Application; intent?: OtpIntent } = {},
  ): Promise<AuthSession> {
    // Admins must use their password; an inbox alone isn't enough for the console.
    if (application === Application.ADMIN_CONSOLE) throw new OtpNotAllowedForAdminException();

    const id = await this.otp.verify(identifier, code);
    const existing = await this.findUserByIdentifier(id);
    const now = new Date();

    let user: UserWithProviders;
    if (existing) {
      this.assertActive(existing);
      // Whatever app is asking: an inbox alone must never yield an admin token
      // (the access token's role is all the Admin Console API checks).
      if (isAdminRole(existing.role)) throw new OtpNotAllowedForAdminException();
      user = await this.authRepository.updateUser(existing.id, {
        lastLoginAt: now,
        ...(id.type === 'email' &&
          !existing.emailVerified &&
          (await this.claimUnverified(existing))),
      });
    } else {
      user = await this.authRepository.createEmailUser({
        name: id.type === 'email' ? id.value.split('@')[0] : 'Customer',
        email: id.type === 'email' ? id.value : phonePlaceholderEmail(id.value),
        phone: id.type === 'phone' ? id.value : null,
        emailVerified: true,
        lastLoginAt: now,
      });
    }

    const hasPassword = user.password !== null;
    const passwordSetupToken =
      !hasPassword || intent === 'reset' ? await this.issuePasswordSetupToken(user.id) : undefined;

    const tokens = await this.tokens.issue(user);
    return AuthMapper.toSession(user, tokens, {
      isNewUser: !existing,
      hasPassword,
      passwordSetupToken,
    });
  }

  // ─── Password setup (after OTP) ──────────────────────────────────────────────

  /**
   * Set a password using the single-use token issued at OTP verification.
   * Every other session is revoked and a fresh pair is returned for this one.
   */
  async setPassword(userId: string, token: string, password: string): Promise<AuthSession> {
    const owner = await this.redis.getAndDelete(this.passwordSetupKey(token));
    if (!owner || owner !== userId) throw new PasswordSetupTokenInvalidException();

    const existing = await this.authRepository.findUserById(userId);
    if (!existing) throw new PasswordSetupTokenInvalidException();
    this.assertActive(existing);

    const user = await this.authRepository.updateUser(userId, {
      password: await argon2.hash(password),
    });

    await this.tokens.revokeAll(userId);
    const tokens = await this.tokens.issue(user);
    return AuthMapper.toSession(user, tokens, { hasPassword: true });
  }

  // ─── OAuth ───────────────────────────────────────────────────────────────────

  async handleOAuthLogin(
    type: OAuthType,
    providerUid: string,
    rawEmail: string,
    name: string,
  ): Promise<OAuthLoginResult> {
    const email = normalizeEmail(rawEmail);
    if (!email) throw new InvalidIdentifierException();
    const now = new Date();

    // Provider identity first; email only links a provider the first time.
    const existing =
      (await this.authRepository.findUserByProvider(type, providerUid)) ??
      (await this.authRepository.findUserByEmailWithProviders(email));

    if (!existing) {
      const user = await this.authRepository.createOAuthUserAndProvider(
        { name, email, emailVerified: true, lastLoginAt: now },
        type,
        providerUid,
      );
      return { user, tokens: await this.tokens.issue(user) };
    }

    this.assertActive(existing);
    // A Google account alone must never yield an admin token: admins use their password.
    if (isAdminRole(existing.role)) throw new OAuthNotAllowedForAdminException();
    if (!existing.providers.some((p) => p.type === type)) {
      await this.authRepository.upsertUserProvider(existing.id, type, providerUid);
    }

    const user = await this.authRepository.updateUser(existing.id, {
      lastLoginAt: now,
      // Keep a name the user chose; only fill it when missing.
      ...(!existing.name && { name }),
      ...(!existing.emailVerified && (await this.claimUnverified(existing))),
    });
    return { user, tokens: await this.tokens.issue(user) };
  }

  /**
   * Park an OAuth sign-in behind a single-use, short-lived code. The browser
   * only ever carries the code; the storefront BFF exchanges it server-side.
   */
  async createOAuthExchangeCode(
    { user, tokens }: OAuthLoginResult,
    bindHash: string,
  ): Promise<string> {
    const code = crypto.randomBytes(32).toString('base64url');
    const record: OAuthExchangeRecord = { session: AuthMapper.toSession(user, tokens), bindHash };
    await this.redis.setWithTTL(
      this.oauthCodeKey(code),
      OAUTH_EXCHANGE_CODE_TTL_S,
      JSON.stringify(record),
    );
    return code;
  }

  /** Single use; only redeemable with the nonce whose hash started the flow. */
  async exchangeOAuthCode(code: string, bind: string): Promise<AuthSession> {
    const raw = await this.redis.getAndDelete(this.oauthCodeKey(code));
    const record = raw ? (JSON.parse(raw) as OAuthExchangeRecord) : null;

    const presented = crypto.createHash('sha256').update(bind).digest('hex');
    const matches =
      !!record &&
      record.bindHash.length === presented.length &&
      crypto.timingSafeEqual(Buffer.from(record.bindHash), Buffer.from(presented));

    if (!record || !matches) {
      throw new UnauthorizedException({
        code: 'OAUTH_CODE_INVALID',
        message: 'Sign-in session expired. Please try again.',
      });
    }
    return record.session;
  }

  // ─── Sessions ────────────────────────────────────────────────────────────────

  async refreshTokens(userId: string, oldRawToken: string): Promise<TokenPair> {
    return this.tokens.rotate(userId, oldRawToken, async () => {
      const user = await this.authRepository.findUserById(userId);
      if (!user || user.status === UserStatus.DELETED) {
        await this.tokens.revokeAll(userId);
        throw new TokenRevokedException();
      }
      return this.tokens.issue(user);
    });
  }

  revokeRefreshToken(rawToken: string) {
    return this.tokens.revoke(rawToken);
  }

  revokeAllSessions(userId: string) {
    return this.tokens.revokeAll(userId);
  }

  // ─── Admin Console password reset (email link) ───────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.authRepository.findUserByEmail(email);
    if (!user?.password) return;

    const token = crypto.randomBytes(32).toString('hex');
    await this.redis.setWithTTL(`pwd:reset:${token}`, PASSWORD_RESET_TTL_S, user.id);

    const resetUrl = `${appUrls.adminConsole}/reset-password?token=${token}`;
    // Not awaited: waiting only for real accounts would let response time
    // reveal which emails are registered.
    this.mailer.sendPasswordResetEmail(user.email, user.name, resetUrl).catch((err: unknown) => {
      this.logger.error(`Password reset email failed: ${(err as Error).message}`);
    });
  }

  async validateToken(token: string, type: TokenType): Promise<void> {
    const keyMap: Record<TokenType, string> = {
      [TokenType.RESET_PASSWORD]: `pwd:reset:${token}`,
    };

    if (!(await this.redis.get(keyMap[type]))) {
      throw new UnauthorizedException({
        message: 'Token is invalid or has expired.',
        code: 'TOKEN_INVALID',
      });
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.redis.getAndDelete(`pwd:reset:${token}`);
    const user = userId ? await this.authRepository.findUserById(userId) : null;
    if (!user?.password) {
      throw new UnauthorizedException({
        message: 'Token is invalid or has expired.',
        code: 'TOKEN_INVALID',
      });
    }

    if (await argon2.verify(user.password, newPassword)) {
      throw new BadRequestException('New password cannot be the same as the current password.');
    }

    await this.authRepository.updateUser(user.id, { password: await argon2.hash(newPassword) });
    await this.tokens.revokeAll(user.id);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    if (oldPassword === newPassword) {
      throw new BadRequestException('New password cannot be the same as the old password.');
    }

    const user = await this.authRepository.findUserById(userId);
    if (!user?.password || !(await argon2.verify(user.password, oldPassword))) {
      throw new UnauthorizedException({
        message: 'Current password is incorrect.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    await this.authRepository.updateUser(userId, { password: await argon2.hash(newPassword) });
    await this.tokens.revokeAll(userId);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async findUserByIdentifier(id: Identifier): Promise<UserWithProviders | null> {
    return id.type === 'email'
      ? this.authRepository.findUserByEmailWithProviders(id.value)
      : this.authRepository.findUserByPhoneVariants(legacyPhoneVariants(id.value));
  }

  /**
   * The real owner just proved control of this email. Anything set up before
   * that (a password from an unverified signup, its sessions) can't be trusted.
   */
  private async claimUnverified(user: User) {
    if (user.password) await this.tokens.revokeAll(user.id);
    return { emailVerified: true, password: null };
  }

  private assertActive(user: Pick<User, 'status'>) {
    if (user.status === UserStatus.DELETED) throw new UserDeactivatedException();
  }

  private assertAllowedInApplication(user: Pick<User, 'role'>, application?: Application) {
    if (application === Application.ADMIN_CONSOLE && !isAdminRole(user.role)) {
      throw new ForbiddenException(
        'Access denied. Only administrative accounts may sign in to the Admin Console.',
      );
    }
  }

  private async issuePasswordSetupToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.redis.setWithTTL(this.passwordSetupKey(token), PASSWORD_SETUP_TTL_S, userId);
    return token;
  }

  private oauthCodeKey(code: string) {
    return `auth:oauth:code:${crypto.createHash('sha256').update(code).digest('hex')}`;
  }

  private passwordSetupKey(token: string) {
    return `auth:pwdsetup:${crypto.createHash('sha256').update(token).digest('hex')}`;
  }
}
