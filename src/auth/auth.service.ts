import { env } from '@/config/env';
import { PrismaService } from '@/prisma/prisma.service';
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
import { AuthMapper } from './auth.mapper';
import { LoginPayloadDto } from './dto/login-dto';

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

  /**
   * Find user by email
   * @param email string
   * @returns {User}
   */
  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find user by id
   * @param userId - string
   * @returns {User}
   */
  findUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  /**
   *  Create new user
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

  /**
   *  User Login
   */
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
    return AuthMapper.toLoginResponse(user, tokens);
  }

  /**
   * Update user's last logined at
   */
  async updateLastLoginAt(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }
}
