import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { PinoLogger } from 'nestjs-pino';
import * as http from 'node:http';

interface FastifyErrorLike {
  statusCode: number;
  code: string;
  message: string;
}

interface PrismaErrorLike {
  code: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { status, message, errors, code, details } = this.resolveException(exception);

    reply.header('x-request-id', request.id);

    const retryAfter = details?.retryAfter;
    if (typeof retryAfter === 'number') {
      reply.header('Retry-After', String(retryAfter));
    }

    const responseBody = {
      success: false,
      statusCode: status,
      code: code ?? resolveCode(status),
      message,
      errors: errors ?? null,
      ...(details && { details }),
      requestId: request.id,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      const stack =
        exception instanceof Error
          ? exception.stack
          : typeof exception === 'object' && exception !== null && 'stack' in exception
            ? String((exception as { stack?: unknown }).stack)
            : undefined;

      const errMessage =
        code?.toLowerCase() ||
        (exception instanceof Error
          ? exception.message.toLowerCase().replace(/[^a-z0-9_]+/g, '_')
          : 'internal_server_error');

      this.logger.error(
        {
          requestId: request.id,
          path: request.url,
          method: request.method,
          status,
          stack,
          err: exception,
        },
        errMessage,
      );
    }

    reply.status(status).send(responseBody);
  }

  private resolveException(exception: unknown): {
    status: number;
    message: string;
    errors: Record<string, unknown>[] | null;
    code?: string;
    details?: Record<string, unknown>;
  } {
    // NestJS HttpException (includes BadRequestException, NotFoundException, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      // ValidationPipe throws structured object
      if (typeof response === 'object' && response !== null) {
        const res = response as Record<string, unknown>;
        const isValidation = Array.isArray(res.message);
        const customCode = typeof res.code === 'string' ? res.code : undefined;
        return {
          status,
          message: isValidation
            ? ((res.error as string) ?? 'Validation failed')
            : typeof res.message === 'string'
              ? res.message
              : 'Request failed',
          errors: isValidation
            ? (res.message as string[]).map((m) => ({ message: m }))
            : Array.isArray(res.errors)
              ? (res.errors as Record<string, unknown>[])
              : null,
          code: customCode,
          details:
            typeof res.details === 'object' && res.details !== null
              ? (res.details as Record<string, unknown>)
              : undefined,
        };
      }

      return { status, message: String(response), errors: null };
    }

    // Fastify native errors (e.g. payload too large, bad JSON)
    if (this.isFastifyError(exception)) {
      return {
        status: exception.statusCode,
        message: exception.message,
        errors: null,
      };
    }

    // Prisma errors
    if (this.isPrismaError(exception)) {
      return this.handlePrismaError(exception);
    }

    // Unknown / unhandled errors
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      errors: null,
    };
  }

  private isFastifyError(exception: unknown): exception is FastifyErrorLike {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'statusCode' in exception &&
      'code' in exception
    );
  }

  private isPrismaError(exception: unknown): exception is PrismaErrorLike {
    if (typeof exception !== 'object' || exception === null || !('code' in exception)) {
      return false;
    }
    const code = (exception as Record<string, unknown>).code;
    return typeof code === 'string' && code.startsWith('P');
  }

  private handlePrismaError(exception: PrismaErrorLike): {
    status: number;
    message: string;
    errors: null;
  } {
    const prismaErrorMap: Record<string, { status: number; message: string }> = {
      P2002: {
        status: HttpStatus.CONFLICT,
        message: 'A record with this value already exists',
      },
      P2025: { status: HttpStatus.NOT_FOUND, message: 'Record not found' },
      P2003: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Foreign key constraint failed',
      },
      P2014: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Relation violation',
      },
    };

    const resolved = prismaErrorMap[exception.code] ?? {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database error',
    };

    return { ...resolved, errors: null };
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
