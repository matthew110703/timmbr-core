import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { PinoLogger } from 'nestjs-pino';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { status, message, errors } = this.resolveException(exception);

    const responseBody = {
      success: false,
      statusCode: status,
      message,
      errors: errors ?? null,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
    };

    this.logger.error(
      {
        method: request.method,
        url: request.url,
        status,
        stack: exception instanceof Error ? exception.stack : String(exception),
      },
      `[${request.method}] ${request.url} -> ${status} | ${message}`,
    );

    reply.status(status).send(responseBody);
  }

  private resolveException(exception: unknown): {
    status: number;
    message: string;
    errors: Record<string, any>[] | null;
  } {
    // NestJS HttpException (includes BadRequestException, NotFoundException, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      // ValidationPipe throws structured object
      if (typeof response === 'object' && response !== null) {
        const res = response as Record<string, any>;
        return {
          status,
          message: res.message ?? 'Request failed',
          errors: Array.isArray(res.errors) ? res.errors : null,
        };
      }

      return { status, message: String(response), errors: null };
    }

    // Fastify native errors (e.g. payload too large, bad JSON)
    if (this.isFastifyError(exception)) {
      return {
        status: (exception as any).statusCode ?? HttpStatus.BAD_REQUEST,
        message: (exception as any).message ?? 'Bad request',
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

  private isFastifyError(exception: unknown): boolean {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'statusCode' in exception &&
      'code' in exception
    );
  }

  private isPrismaError(exception: unknown): boolean {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof (exception as any).code === 'string' &&
      (exception as any).code.startsWith('P')
    );
  }

  private handlePrismaError(exception: unknown): {
    status: number;
    message: string;
    errors: null;
  } {
    const code = (exception as any).code as string;

    const prismaErrorMap: Record<string, { status: number; message: string }> =
      {
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

    const resolved = prismaErrorMap[code] ?? {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database error',
    };

    return { ...resolved, errors: null };
  }
}
