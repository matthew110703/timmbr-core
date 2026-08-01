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
import { LoginIntercepter } from './interceptors/LoginInterceptor';
import { SignupInterceptor } from './interceptors/SignupInterceptor';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getCookieOptions } from '@/config/cookie.config';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { JwtPayload } from './types/jwt.types';
import { env } from '@/config/env';
import { OAuthLoginResult } from './auth.service';
import passport from 'passport';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('signup')
  @Public()
  @UseInterceptors(SignupInterceptor)
  create(@Body() dto: SignUpPayloadDto) {
    return this.auth.signup(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @UseInterceptors(LoginIntercepter)
  @ResponseMessage('Login successful.')
  login(@Body() dto: LoginPayloadDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
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

  @Post('logout')
  @Public()
  @HttpCode(200)
  @ResponseMessage('Logged out successfully.')
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = req.cookies?.['refreshToken'];
    if (token) await this.auth.revokeRefreshToken(token);
    reply.clearCookie('refreshToken', { path: getCookieOptions().path });
  }

  @Get('verify-email')
  @Public()
  @HttpCode(200)
  @ResponseMessage('Email verified successfully.')
  async verifyEmail(@Query('token') token: string) {
    await this.auth.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(200)
  @ResponseMessage('Verification email resent successfully.')
  async resendVerification(@Req() req: FastifyRequest) {
    const user = req.user as unknown as JwtPayload;
    return this.auth.resendVerificationEmail(user.sub);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(200)
  @ResponseMessage("If this email is registered, you'll receive a reset link shortly.")
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
  }

  @Get('validate-token')
  @Public()
  @HttpCode(200)
  @ResponseMessage('Token is valid.')
  async validateToken(@Query() dto: ValidateTokenDto) {
    await this.auth.validateToken(dto.token, dto.type);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(200)
  @ResponseMessage('Password reset successfully.')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Post('change-password')
  @HttpCode(200)
  @ResponseMessage('Password changed successfully.')
  async changePassword(@Req() req: FastifyRequest, @Body() dto: ChangePasswordDto) {
    const user = req.user as unknown as JwtPayload;
    await this.auth.changePassword(user.sub, dto.oldPassword, dto.newPassword);
  }

  @Get('google')
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

  @Get('google/callback')
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
