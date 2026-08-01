import { APP_ROUTES } from '@/app.routes';
import { Public, ResponseMessage } from '@/common/decorators';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SignUpPayloadDto } from './dto/sign-up-dto';
import { AuthService } from './auth.service';
import { LoginPayloadDto } from './dto/login-dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ValidateTokenDto,
  ChangePasswordDto,
} from './dto/password.dto';
import { LoginInterceptor } from './interceptors/LoginInterceptor';
import { SignupInterceptor } from './interceptors/SignupInterceptor';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getCookieOptions } from '@/config/cookie.config';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { JwtPayload } from './types/jwt.types';
import { env } from '@/config/env';
import { OAuthLoginResult } from './auth.service';
import passport from 'passport';
import { AUTH_ROUTES } from './auth.routes';

@Controller(APP_ROUTES.AUTH)
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post(AUTH_ROUTES.SIGNUP)
  @Public()
  @UseInterceptors(SignupInterceptor)
  create(@Body() dto: SignUpPayloadDto) {
    return this.auth.signup(dto);
  }

  @Post(AUTH_ROUTES.LOGIN)
  @Public()
  @HttpCode(200)
  @UseInterceptors(LoginInterceptor)
  @ResponseMessage('Login successful.')
  login(@Body() dto: LoginPayloadDto) {
    return this.auth.login(dto);
  }

  @Post(AUTH_ROUTES.REFRESH)
  @Public()
  @UseGuards(RefreshTokenGuard)
  @HttpCode(200)
  @ResponseMessage('Token refreshed successfully.')
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const user = req.user as unknown as JwtPayload & { refreshToken: string };
    const tokens = await this.auth.refreshTokens(user.sub, user.refreshToken);
    reply.setCookie('refreshToken', tokens.refreshToken, getCookieOptions());
    return { accessToken: tokens.accessToken };
  }

  @Post(AUTH_ROUTES.LOGOUT)
  @Public()
  @HttpCode(200)
  @ResponseMessage('Logged out successfully.')
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = req.cookies?.['refreshToken'];
    if (token) await this.auth.revokeRefreshToken(token);
    reply.clearCookie('refreshToken', { path: getCookieOptions().path });
  }

  @Get(AUTH_ROUTES.VERIFY_EMAIL)
  @Public()
  @HttpCode(200)
  @ResponseMessage('Email verified successfully.')
  async verifyEmail(@Query('token') token: string) {
    await this.auth.verifyEmail(token);
  }

  @Post(AUTH_ROUTES.RESEND_VERIFICATION)
  @HttpCode(200)
  @ResponseMessage('Verification email resent successfully.')
  async resendVerification(@Req() req: FastifyRequest) {
    const user = req.user as unknown as JwtPayload;
    return this.auth.resendVerificationEmail(user.sub);
  }

  @Post(AUTH_ROUTES.FORGOT_PASSWORD)
  @Public()
  @HttpCode(200)
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
  @ResponseMessage('Password reset successfully.')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Post(AUTH_ROUTES.CHANGE_PASSWORD)
  @HttpCode(200)
  @ResponseMessage('Password changed successfully.')
  async changePassword(@Req() req: FastifyRequest, @Body() dto: ChangePasswordDto) {
    const user = req.user as unknown as JwtPayload;
    await this.auth.changePassword(user.sub, dto.oldPassword, dto.newPassword);
  }

  @Get(AUTH_ROUTES.GOOGLE)
  @Public()
  googleAuth(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    // hijack() tells Fastify to not touch the reply after the handler returns.
    // Without this, Fastify sees reply.sent===false after passport calls reply.raw.end()
    // and tries to finalize the response a second time, causing a 500.
    reply.hijack();
    const handler = passport.authenticate('google', {
      scope: ['email', 'profile'],
      session: false,
    }) as (req: unknown, res: unknown, next: () => void) => void;
    handler(req.raw, reply.raw, () => {});
  }

  @Get(AUTH_ROUTES.GOOGLE_CALLBACK)
  @Public()
  async googleCallback(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const result = await new Promise<OAuthLoginResult>((resolve, reject) => {
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

    reply.setCookie('refreshToken', result.tokens.refreshToken, getCookieOptions());
    await reply.redirect(
      `${env.CLIENT_BASE_URL}/oauth/callback?token=${result.tokens.accessToken}`,
    );
  }
}
