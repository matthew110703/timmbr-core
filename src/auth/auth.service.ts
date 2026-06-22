import { env } from '@/config/env';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { MailerService } from '@/mailer/mailer.service';
import { User } from '@/types/user';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SignUpPayloadDto } from './dto/sign-up-dto';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { AuthMapper } from './auth.mapper';
import { LoginPayloadDto } from './dto/login-dto';
import { TokenRevokedException } from '@/common/exceptions/token.exception';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
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
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async signup(payload: SignUpPayloadDto) {
    const existingUser = await this.findUserByEmail(payload.email);

    if (existingUser) {
      throw new ConflictException('Email already exists.');
    }

    const hashedPassword = await argon2.hash(payload.password);

    const user = await this.prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        password: hashedPassword,
      },
      include: { providers: true },
    });

    const tokens = await this.generateJwtTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    const verificationToken = await this.generateEmailVerificationToken(user.id);
    const verificationUrl = `${env.APP_BASE_URL}/api/v1/auth/verify-email?token=${verificationToken}`;
    await this.mailer.sendVerificationEmail(user.email, user.name, verificationUrl);

    return AuthMapper.toSignUpResponse(user, tokens);
  }

  async login(payload: LoginPayloadDto) {
    const user = await this.findUserByEmail(payload.email);

    if (!user) {
      throw new NotFoundException('User not found.');
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
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.redis.getAndDelete(`email:verify:${token}`);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired verification token.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
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
