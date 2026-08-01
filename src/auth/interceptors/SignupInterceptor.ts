import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { FastifyReply } from 'fastify';
import { getCookieOptions } from '@/config/cookie.config';
import { SignUpResponseDto } from '../dto/sign-up-dto';
import { MessageResult } from '@/common/types/api-response.types';

@Injectable()
export class SignupInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    return next.handle().pipe(
      map(({ message, data }: MessageResult<SignUpResponseDto>) => {
        const { refreshToken, ...rest } = data;
        const reply = context.switchToHttp().getResponse<FastifyReply>();
        reply.setCookie('refreshToken', refreshToken, getCookieOptions());
        return { message, data: rest };
      }),
    );
  }
}
