import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as http from 'node:http';
import { RESPONSE_MESSAGE_KEY } from '@/decorators/response-message.decorator';
import { SKIP_TRANSFORM_KEY } from '@/decorators/skip-transform.decorator';
import {
  ApiSuccessResponse,
  PaginatedApiResponse,
  PaginatedResult,
} from '@/types/api-response.types';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T> | PaginatedApiResponse<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T | PaginatedResult<T>>,
  ): Observable<ApiSuccessResponse<T> | PaginatedApiResponse<T>> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle() as Observable<ApiSuccessResponse<T> | PaginatedApiResponse<T>>;

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const res = context.switchToHttp().getResponse<FastifyReply>();
    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'Success';

    return next.handle().pipe(
      map((data) => {
        const statusCode = res.statusCode;
        const base = {
          success: true as const,
          statusCode,
          code: resolveCode(statusCode),
          message,
          path: req.url,
          method: req.method,
          timestamp: new Date().toISOString(),
        };
        if (isPaginatedResult<T>(data)) {
          return { ...base, data: data.data, meta: data.meta };
        }
        return { ...base, data };
      }),
    );
  }
}

function resolveCode(statusCode: number): string {
  const label = http.STATUS_CODES[statusCode];
  if (!label) return 'UNKNOWN';
  return label
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
    .replace(/ +/g, '_');
}

function isPaginatedResult<T>(value: unknown): value is PaginatedResult<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'data' in value &&
    Array.isArray((value as Record<string, unknown>).data) &&
    'meta' in value &&
    typeof (value as Record<string, unknown>).meta === 'object' &&
    (value as Record<string, unknown>).meta !== null
  );
}
