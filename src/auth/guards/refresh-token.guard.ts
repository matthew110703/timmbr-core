import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenExpiredException, TokenInvalidException } from '@/common/exceptions/token.exception';

@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {
  handleRequest(err: any, user: any, info: any) {
    if (info?.name === 'TokenExpiredError') throw new TokenExpiredException();
    if (info?.name === 'JsonWebTokenError') throw new TokenInvalidException();
    if (err || !user) throw new TokenInvalidException();
    return user;
  }
}
