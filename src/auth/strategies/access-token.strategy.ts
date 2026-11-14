import { env } from '@/config/env';
import { UserDeactivatedException } from '@/common/exceptions/user.exception';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthRepository } from '../auth.repository';
import { JwtPayload } from '../types/jwt.types';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authRepository: AuthRepository) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.JWT_ACCESS_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.authRepository.findUserById(payload.sub);
    if (!user) {
      return payload;
    }
    if (user.status === UserStatus.DELETED) {
      throw new UserDeactivatedException();
    }
    return {
      ...payload,
      email: user.email,
      role: user.role,
      permissions: user.permissions ?? [],
    };
  }
}
