import { env } from '@/config/env';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types/jwt.types';
import { FastifyRequest } from 'fastify';
import { readRefreshToken } from '@/config/cookie.config';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: FastifyRequest) => readRefreshToken(req) ?? null,
      ]),
      secretOrKey: env.JWT_REFRESH_SECRET,
      passReqToCallback: true,
    });
  }

  validate(req: FastifyRequest, payload: JwtPayload) {
    return {
      ...payload,
      refreshToken: readRefreshToken(req),
    };
  }
}
