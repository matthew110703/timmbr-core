import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtPayload } from '@/auth/types/jwt.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return request.user as unknown as JwtPayload | undefined;
  },
);
