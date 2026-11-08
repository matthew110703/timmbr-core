import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { PERMISSIONS_KEY } from '@/common/decorators/permissions.decorator';
import { JwtPayload } from '@/auth/types/jwt.types';
import { StaffPermission } from '@/common/constants/permissions.constant';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<StaffPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user as unknown as JwtPayload | undefined;

    if (!user) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You do not have the required permissions to perform this action.',
      });
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER) {
      return true;
    }

    if (user.role === UserRole.STAFF) {
      const userPermissions = user.permissions ?? [];
      const hasAll = requiredPermissions.every((perm) => userPermissions.includes(perm));
      if (!hasAll) {
        throw new ForbiddenException({
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have the required permissions to perform this action.',
        });
      }
      return true;
    }

    throw new ForbiddenException({
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'You do not have the required permissions to perform this action.',
    });
  }
}
