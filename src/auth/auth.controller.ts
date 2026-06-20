import { Public, ResponseMessage } from '@/decorators';
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SignUpPayloadDto } from './dto/sign-up-dto';
import { AuthService } from './auth.service';
import { LoginPayloadDto } from './dto/login-dto';
import { LoginIntercepter } from './interceptors/LoginInterceptor';
import { SignupInterceptor } from './interceptors/SignupInterceptor';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getCookieOptions } from '@/config/cookie.config';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { JwtPayload } from './types/jwt.types';

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
}
