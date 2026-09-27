import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Application } from '../types/application.types';

export const CurrentApplication = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Application | undefined => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return request.application;
  },
);
