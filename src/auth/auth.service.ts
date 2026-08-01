import { env } from '@/config/env';
import { RedisService } from '@/redis/redis.service';
import { MailerService } from '@/mailer/mailer.service';
import { User, UserProvider } from '@/common/types/user';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuthType, UserStatus } from '@prisma/client';

export interface OAuthLoginResult {
  user: User & { providers: UserProvider[] };
  tokens: { accessToken: string; refreshToken: string };
}
import { JwtService } from '@nestjs/jwt';
import { SignUpPayloadDto } from './dto/sign-up-dto';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { AuthMapper } from './auth.mapper';
import { LoginPayloadDto } from './dto/login-dto';
import { TokenRevokedException } from '@/common/exceptions/token.exception';
import { UserDeactivatedException } from '@/common/exceptions/user.exception';
import { TokenType } from './types/token-type.enum';
import { AuthRepository } from './auth.repository';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private authRepository: AuthRepository,
    private redis: RedisService,
    private mailer: MailerService,
  ) {}

  async generateJwtTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
      }),
      this.jwt.signAsync(payload, {
        secret: env.JWT_REFRESH_SECRET,
        expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  findUserByEmail(email: string) {
    return this.authRepository.findUserByEmail(email);
  }

  findUserById(userId: string) {
    return this.authRepository.findUserById(userId);
  }

  async signup(payload: SignUpPayloadDto) {
    const existingUser = await this.authRepository.findUserByEmailWithProviders(payload.email);

    if (existingUser) {
      if (existingUser.password !== null) {
        throw new ConflictException('Email already exists.');
      }
      // OAuth-only account — merge by adding a password
      const hashedPassword = await argon2.hash(payload.password);
      const updatedUser = await this.authRepository.updateUser(existingUser.id, {
        password: hashedPassword,
      });
      const tokens = await this.generateJwtTokens(updatedUser);
      await this.storeRefreshToken(updatedUser.id, tokens.refreshToken);
      return AuthMapper.toSignUpResponse(updatedUser, tokens);
    }

    const hashedPassword = await argon2.hash(payload.password);

    const user = await this.authRepository.createEmailUser({
      name: payload.name,
      email: payload.email,
      password: hashedPassword,
    });

    const tokens = await this.generateJwtTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    const verificationToken = await this.generateEmailVerificationToken(user.id);
    const verificationUrl = `${env.APP_BASE_URL}/api/v1/auth/verify-email?token=${verificationToken}`;
    await this.mailer.sendVerificationEmail(user.email, user.name, verificationUrl);

    return AuthMapper.toSignUpResponse(user, tokens);
  }

  async handleOAuthLogin(
    type: OAuthType,
    providerUid: string,
    email: string,
    name: string,
  ): Promise<OAuthLoginResult> {
    const existingUser = await this.authRepository.findUserByEmailWithProviders(email);

    if (!existingUser) {
      const finalUser = await this.authRepository.createOAuthUserAndProvider(
        { name, email, emailVerified: true },
        type,
        providerUid,
      );
      const tokens = await this.generateJwtTokens(finalUser);
      await this.storeRefreshToken(finalUser.id, tokens.refreshToken);
      return { user: finalUser, tokens };
    }

    await this.authRepository.upsertUserProvider(existingUser.id, type, providerUid);
    const finalUser = await this.authRepository.updateUser(existingUser.id, { name });
    const tokens = await this.generateJwtTokens(finalUser);
    await this.storeRefreshToken(finalUser.id, tokens.refreshToken);
    return { user: finalUser, tokens };
  }

  async login(payload: LoginPayloadDto) {
    const user = await this.findUserByEmail(payload.email);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.status === UserStatus.DELETED) {
      throw new UserDeactivatedException();
    }

    const isPasswordValid = await argon2.verify(user?.password || '', payload.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const tokens = await this.generateJwtTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);
    return AuthMapper.toLoginResponse(user, tokens);
  }

  async refreshTokens(userId: string, oldRawToken: string) {
    const storedUserId = await this.redis.getAndDelete(this.tokenKey(oldRawToken));

    if (!storedUserId || storedUserId !== userId) {
      throw new TokenRevokedException();
    }

    const user = await this.findUserById(userId);
    if (!user) {
      throw new TokenRevokedException();
    }

    const tokens = await this.generateJwtTokens(user);
    await this.storeRefreshToken(userId, tokens.refreshToken);
    return tokens;
  }

  async revokeRefreshToken(rawToken: string) {
    await this.redis.delete(this.tokenKey(rawToken));
  }

  async updateLastLoginAt(userId: string) {
    await this.authRepository.updateLastLoginAt(userId);
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.redis.getAndDelete(`email:verify:${token}`);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired verification token.');
    }
    await this.authRepository.updateEmailVerified(userId);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.findUserByEmail(email);
    if (!user) return;
    if (!user.password) return;

    const token = crypto.randomBytes(32).toString('hex');
    await this.redis.setWithTTL(`pwd:reset:${token}`, 900, user.id);

    const resetUrl = `${env.CLIENT_BASE_URL}/reset-password?token=${token}`;
    await this.mailer.sendPasswordResetEmail(user.email, user.name, resetUrl);
  }

  async validateToken(token: string, type: TokenType): Promise<void> {
    const keyMap: Record<TokenType, string> = {
      [TokenType.RESET_PASSWORD]: `pwd:reset:${token}`,
    };

    const value = await this.redis.get(keyMap[type]);
    if (!value) {
      throw new UnauthorizedException({
        message: 'Token is invalid or has expired.',
        code: 'TOKEN_INVALID',
      });
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.redis.getAndDelete(`pwd:reset:${token}`);
    if (!userId) {
      throw new UnauthorizedException({
        message: 'Token is invalid or has expired.',
        code: 'TOKEN_INVALID',
      });
    }

    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!user.password) {
      throw new UnauthorizedException({
        message: 'This account uses OAuth login and has no password to reset.',
        code: 'NO_PASSWORD_ACCOUNT',
      });
    }

    const isSame = await argon2.verify(user.password, newPassword);
    if (isSame) {
      throw new BadRequestException('New password cannot be the same as the current password.');
    }

    const hashedPassword = await argon2.hash(newPassword);
    await this.authRepository.updateUser(userId, { password: hashedPassword });
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    if (oldPassword === newPassword) {
      throw new BadRequestException('New password cannot be the same as the old password.');
    }

    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!user.password) {
      throw new UnauthorizedException({
        message: 'This account uses OAuth login and has no password to change.',
        code: 'NO_PASSWORD_ACCOUNT',
      });
    }

    const isValid = await argon2.verify(user.password, oldPassword);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const hashedPassword = await argon2.hash(newPassword);
    await this.authRepository.updateUser(userId, { password: hashedPassword });

    await this.redis.setWithTTL(`pwd:change:${userId}`, 1_209_600, new Date().toISOString());
  }

  async resendVerificationEmail(userId: string): Promise<{ attemptsLeft: number }> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    if (user.emailVerified) {
      throw new ConflictException('Email is already verified.');
    }

    const MAX_ATTEMPTS = 3;
    const count = await this.redis.incrementWithExpiry(`resend:verify:${userId}`, 3600);
    if (count > MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many resend requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = await this.generateEmailVerificationToken(userId);
    const verificationUrl = `${env.APP_BASE_URL}/api/v1/auth/verify-email?token=${token}`;
    await this.mailer.sendVerificationEmail(user.email, user.name, verificationUrl);

    return { attemptsLeft: MAX_ATTEMPTS - count };
  }

  private async generateEmailVerificationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.redis.setWithTTL(`email:verify:${token}`, 86400, userId);
    return token;
  }

  private async storeRefreshToken(userId: string, rawToken: string) {
    await this.redis.setWithTTL(this.tokenKey(rawToken), env.REFRESH_TOKEN_TTL, userId);
  }

  private tokenKey(rawToken: string) {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return `auth:refresh:${hash}`;
  }
}
