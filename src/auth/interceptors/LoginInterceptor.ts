import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Observable, switchMap } from 'rxjs';
import { LoginResponseDto } from '../dto/login-dto';
import { FastifyReply } from 'fastify';
import { getCookieOptions } from '@/config/cookie.config';

@Injectable()
export class LoginIntercepter implements NestInterceptor {
  constructor(private readonly auth: AuthService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    return next.handle().pipe(
      switchMap(async ({ data }: { data: LoginResponseDto }) => {
        const { refreshToken, ...rest } = data;
        if (rest.id) {
          await this.auth.updateLastLoginAt(rest.id);
        }
        const reply = context.switchToHttp().getResponse<FastifyReply>();
        reply.setCookie('refreshToken', refreshToken, getCookieOptions());
        return rest;
      }),
    );
  }
}
