import { env } from '@/config/env';
import { PrismaService } from '@/prisma/prisma.service';
import { User } from '@/types/user';
import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SignUpPayloadDto } from './dto/sign-up-dto';
import * as argon2 from 'argon2';
import { AuthMapper } from './auth.mapper';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
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
        expiresIn: '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * POST - Create new user
   */
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
      include: {
        providers: true,
      },
    });

    const tokens = await this.generateJwtTokens(user);
    return AuthMapper.toSignUpResponse(user, tokens);
  }
}
