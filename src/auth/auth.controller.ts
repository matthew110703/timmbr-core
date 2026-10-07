import { APP_ROUTES } from '@/app.routes';
import { CurrentApplication, Public, ResponseMessage } from '@/common/decorators';
import { Application } from '@/common/types/application.types';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import fastifyCookie from '@fastify/cookie';
import * as crypto from 'node:crypto';
import passport from 'passport';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { appUrls, env } from '@/config/env';
import { clearRefreshCookie, readRefreshToken, setRefreshCookie } from '@/config/cookie.config';
import { OAuthStateInvalidException } from '@/common/exceptions/auth.exception';
import { AuthService, OAuthLoginResult } from './auth.service';
import { LoginPayloadDto } from './dto/login-dto';
import { OAuthExchangeDto, SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { TrustedClientGuard } from '@/common/guards/trusted-client.guard';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SetPasswordDto,
  ValidateTokenDto,
} from './dto/password.dto';
import { SessionCookieInterceptor } from './interceptors/SessionCookieInterceptor';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { JwtPayload } from './types/jwt.types';
import { AUTH_ROUTES } from './auth.routes';
import {
  OAUTH_BIND_COOKIE,
  OAUTH_BIND_HASH_RE,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_S,
} from './auth.constants';

/** Per-IP limits on top of the per-identifier limits inside OtpService. */
const STRICT_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
const LOGIN_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

/**
 * Always pass the status to reply.redirect(): Nest sets 200 on the reply before
 * GET handlers run, and Fastify 5 reuses an already-set status for redirects —
 * a bare redirect() would answer 200 with a Location the browser ignores.
 */
const FOUND = HttpStatus.FOUND;

const OAUTH_STATE_COOKIE_PATH = `/api/v1/auth/${AUTH_ROUTES.GOOGLE}`;

@Controller(APP_ROUTES.AUTH)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private auth: AuthService) {}

  // ─── Sign-in ─────────────────────────────────────────────────────────────────

  @Post(AUTH_ROUTES.LOGIN)
  @Public()
  @HttpCode(200)
  @Throttle(LOGIN_THROTTLE)
  @UseInterceptors(SessionCookieInterceptor)
  @ResponseMessage('Login successful.')
  login(@Body() dto: LoginPayloadDto, @CurrentApplication() application?: Application) {
    return this.auth.login(dto, application);
  }

  @Post(AUTH_ROUTES.OTP_SEND)
  @Public()
  @HttpCode(200)
  @Throttle(STRICT_THROTTLE)
  @ResponseMessage('Verification code sent successfully.')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.auth.sendOtp(dto.identifier);
  }

  @Post(AUTH_ROUTES.OTP_VERIFY)
  @Public()
  @HttpCode(200)
  @Throttle(STRICT_THROTTLE)
  @UseInterceptors(SessionCookieInterceptor)
  @ResponseMessage('Verification successful.')
  verifyOtp(@Body() dto: VerifyOtpDto, @CurrentApplication() application?: Application) {
    return this.auth.verifyOtp(dto.identifier, dto.code, { application, intent: dto.intent });
  }

  /** Set a password with the token from OTP verification (new account / forgot password). */
  @Post(AUTH_ROUTES.PASSWORD_SET)
  @HttpCode(200)
  @Throttle(STRICT_THROTTLE)
  @UseInterceptors(SessionCookieInterceptor)
  @ResponseMessage('Password saved.')
  setPassword(@Req() req: FastifyRequest, @Body() dto: SetPasswordDto) {
    const user = req.user as unknown as JwtPayload;
    return this.auth.setPassword(user.sub, dto.token, dto.password);
  }

  // ─── Session ─────────────────────────────────────────────────────────────────

  @Post(AUTH_ROUTES.REFRESH)
  @Public()
  @UseGuards(RefreshTokenGuard)
  @HttpCode(200)
  @ResponseMessage('Token refreshed successfully.')
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const user = req.user as unknown as JwtPayload & { refreshToken: string };
    const tokens = await this.auth.refreshTokens(user.sub, user.refreshToken);
    // Trusted clients (storefront BFF) keep the refresh token in their own cookie.
    if (req.trustedClient) return tokens;
    setRefreshCookie(reply, req.application, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post(AUTH_ROUTES.LOGOUT)
  @Public()
  @HttpCode(200)
  @ResponseMessage('Logged out successfully.')
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = readRefreshToken(req);
    if (token) await this.auth.revokeRefreshToken(token);
    if (!req.trustedClient) clearRefreshCookie(reply, req.application);
  }

  @Post(AUTH_ROUTES.LOGOUT_ALL)
  @HttpCode(200)
  @ResponseMessage('Logged out of all devices.')
  async logoutAll(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const user = req.user as unknown as JwtPayload;
    await this.auth.revokeAllSessions(user.sub);
    if (!req.trustedClient) clearRefreshCookie(reply, req.application);
  }

  // ─── Passwords ───────────────────────────────────────────────────────────────

  @Post(AUTH_ROUTES.FORGOT_PASSWORD)
  @Public()
  @HttpCode(200)
  @Throttle(STRICT_THROTTLE)
  @ResponseMessage("If this email is registered, you'll receive a reset link shortly.")
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
  }

  @Get(AUTH_ROUTES.VALIDATE_TOKEN)
  @Public()
  @HttpCode(200)
  @ResponseMessage('Token is valid.')
  async validateToken(@Query() dto: ValidateTokenDto) {
    await this.auth.validateToken(dto.token, dto.type);
  }

  @Post(AUTH_ROUTES.RESET_PASSWORD)
  @Public()
  @HttpCode(200)
  @Throttle(STRICT_THROTTLE)
  @ResponseMessage('Password reset successfully.')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Post(AUTH_ROUTES.CHANGE_PASSWORD)
  @HttpCode(200)
  @Throttle(LOGIN_THROTTLE)
  @ResponseMessage('Password changed successfully.')
  async changePassword(@Req() req: FastifyRequest, @Body() dto: ChangePasswordDto) {
    const user = req.user as unknown as JwtPayload;
    await this.auth.changePassword(user.sub, dto.oldPassword, dto.newPassword);
  }

  // ─── Google OAuth ────────────────────────────────────────────────────────────

  @Get(AUTH_ROUTES.GOOGLE)
  @Public()
  googleAuth(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    // `state` ties the callback to the browser that started the flow (login-CSRF
    // protection): the same nonce goes to Google and into an httpOnly cookie.
    const state = crypto.randomBytes(32).toString('base64url');

    // `bind` is sha256 of a nonce the storefront keeps in its own httpOnly
    // cookie. It travels with the exchange code, so only the browser that
    // started sign-in can redeem it on the storefront (no login CSRF there).
    const bind = (req.query as { bind?: string }).bind;
    if (!bind || !OAUTH_BIND_HASH_RE.test(bind)) {
      void reply.redirect(`${appUrls.storefront}/oauth/callback?status=error`, FOUND);
      return;
    }

    // hijack() tells Fastify to not touch the reply after the handler returns.
    // Without this, Fastify sees reply.sent===false after passport calls reply.raw.end()
    // and tries to finalize the response a second time, causing a 500.
    reply.hijack();
    const cookieOptions = {
      httpOnly: true,
      secure: env.NODE_ENV !== 'dev',
      sameSite: 'lax' as const,
      path: OAUTH_STATE_COOKIE_PATH,
      maxAge: OAUTH_STATE_TTL_S,
    };
    reply.raw.setHeader('Set-Cookie', [
      fastifyCookie.serialize(OAUTH_STATE_COOKIE, state, cookieOptions),
      fastifyCookie.serialize(OAUTH_BIND_COOKIE, bind, cookieOptions),
    ]);

    const handler = passport.authenticate('google', {
      scope: ['email', 'profile'],
      session: false,
      state,
    }) as (req: unknown, res: unknown, next: () => void) => void;
    handler(req.raw, reply.raw, () => {});
  }

  @Get(AUTH_ROUTES.GOOGLE_CALLBACK)
  @Public()
  async googleCallback(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    // Tokens never travel in the URL: the storefront BFF receives a single-use
    // code and exchanges it server-side (POST /auth/oauth/exchange).
    const exchangeUrl = `${appUrls.storefront}/api/auth/oauth/callback`;
    const errorUrl = `${appUrls.storefront}/oauth/callback?status=error`;

    const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];
    const bindHash = req.cookies?.[OAUTH_BIND_COOKIE];
    reply.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_STATE_COOKIE_PATH });
    reply.clearCookie(OAUTH_BIND_COOKIE, { path: OAUTH_STATE_COOKIE_PATH });

    // Every failure (state, Google, Redis) lands the popup on the error page,
    // which reports back to the modal, never on a raw JSON error.
    let code: string;
    try {
      this.assertOAuthState(expectedState, (req.query as { state?: string }).state);
      if (!bindHash || !OAUTH_BIND_HASH_RE.test(bindHash)) throw new OAuthStateInvalidException();
      const result: OAuthLoginResult = await this.authenticateGoogle(req, reply);
      code = await this.auth.createOAuthExchangeCode(result, bindHash);
    } catch (err) {
      this.logger.warn(`Google OAuth callback failed: ${(err as Error).message}`);
      await reply.redirect(errorUrl, FOUND);
      return;
    }

    await reply.redirect(`${exchangeUrl}?code=${encodeURIComponent(code)}`, FOUND);
  }

  /** Trusted-only: swap a single-use OAuth code for the session (tokens in body). */
  @Post(AUTH_ROUTES.OAUTH_EXCHANGE)
  @Public()
  @HttpCode(200)
  @UseGuards(TrustedClientGuard)
  @Throttle(STRICT_THROTTLE)
  @ResponseMessage('Signed in.')
  oauthExchange(@Body() dto: OAuthExchangeDto) {
    return this.auth.exchangeOAuthCode(dto.code, dto.bind);
  }

  private assertOAuthState(expected: string | undefined, received: string | undefined) {
    const valid =
      !!expected &&
      !!received &&
      expected.length === received.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
    if (!valid) throw new OAuthStateInvalidException();
  }

  private authenticateGoogle(req: FastifyRequest, reply: FastifyReply) {
    return new Promise<OAuthLoginResult>((resolve, reject) => {
      (
        passport.authenticate(
          'google',
          { session: false },
          (err: unknown, user: OAuthLoginResult) => {
            if (err || !user)
              return reject(err instanceof Error ? err : new Error('OAuth authentication failed'));
            resolve(user);
          },
        ) as (req: unknown, res: unknown, next: (err?: unknown) => void) => void
      )(req.raw, reply.raw, (err: unknown) => {
        if (err) reject(err instanceof Error ? err : new Error('OAuth callback error'));
      });
    });
  }
}
