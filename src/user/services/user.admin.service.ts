import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PaginatedResult } from '@/common/types/api-response.types';
import {
  EmailAlreadyExistsException,
  UserNotFoundException,
} from '@/common/exceptions/user.exception';
import { JwtPayload } from '@/auth/types/jwt.types';
import { AuthService } from '@/auth/auth.service';
import {
  MASTER_ONLY_PERMISSIONS,
  PERMISSIONS,
  Permission,
  STAFF_ASSIGNABLE_PERMISSIONS,
  findMissingPermissionDependencies,
} from '@/common/constants/permissions.constant';
import { GetAdminUsersQueryDto, GetStaffUsersQueryDto } from '../dto/get-admin-users-query.dto';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';
import { AdminCreateUserResponseDto, AdminUserResponseDto } from '../dto/admin-user-response.dto';
import { AdminUserMapper } from '../mappers/user.admin.mapper';
import { UserRepository } from '../user.repository';

@Injectable()
export class UserAdminService {
  constructor(
    private readonly userRepository: UserRepository,
    @Inject(forwardRef(() => AuthService)) private readonly authService: AuthService,
  ) {}

  async getAll(query: GetAdminUsersQueryDto): Promise<PaginatedResult<AdminUserResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.UserWhereInput = {
      role: query.role && query.role !== UserRole.MASTER ? query.role : { not: UserRole.MASTER },
      ...(query.status && { status: query.status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [users, total] = await this.userRepository.findPaginated(where, page, limit);

    const totalPages = Math.ceil(total / limit);

    return {
      data: users.map((user) => AdminUserMapper.toResponse(user)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getStaffList(query: GetStaffUsersQueryDto): Promise<PaginatedResult<AdminUserResponseDto>> {
    return this.getAll({ ...query, role: UserRole.STAFF });
  }

  async getOne(userId: string): Promise<AdminUserResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException();
    }
    return AdminUserMapper.toResponse(user);
  }

  async update(
    caller: JwtPayload,
    userId: string,
    dto: UpdateAdminUserDto,
  ): Promise<AdminUserResponseDto> {
    const existing = await this.userRepository.findById(userId);
    if (!existing) {
      throw new UserNotFoundException();
    }

    // Master user accounts cannot be modified via admin user endpoints
    if (existing.role === UserRole.MASTER) {
      throw new ForbiddenException('Master user accounts cannot be modified.');
    }

    const isMaster = caller.role === UserRole.MASTER;
    const callerPermissions = caller.permissions ?? [];

    // Self-privilege escalation guard: administrators cannot modify their own role or permissions
    if (caller.sub === userId && (dto.permissions !== undefined || dto.role !== undefined)) {
      throw new ForbiddenException('Administrators cannot modify their own role or permissions.');
    }

    // Updating an Admin requires Master role or admins:update permission
    if (existing.role === UserRole.ADMIN) {
      if (!isMaster && !callerPermissions.includes(PERMISSIONS.ADMINS_UPDATE)) {
        throw new ForbiddenException(
          'Only Master or Admins with admins:update permission can update Admin users.',
        );
      }
    } else {
      // Updating Staff or standard Users requires Master role or users:update permission
      if (!isMaster && !callerPermissions.includes(PERMISSIONS.USERS_UPDATE)) {
        throw new ForbiddenException('You do not have permission to update this user account.');
      }
    }

    // Promoting an account to Admin requires Master role or admins:create permission
    if (dto.role === UserRole.ADMIN && existing.role !== UserRole.ADMIN) {
      if (!isMaster && !callerPermissions.includes(PERMISSIONS.ADMINS_CREATE)) {
        throw new ForbiddenException(
          'Only Master or Admins with admins:create permission can promote accounts to Admin.',
        );
      }
    }

    // Staff accounts can only receive operational permissions
    const effectiveRole = dto.role ?? existing.role;
    this.assertValidPermissions(effectiveRole, caller, dto.permissions);

    const user = await this.userRepository.update(userId, dto);
    return AdminUserMapper.toResponse(user);
  }

  async create(caller: JwtPayload, dto: CreateAdminUserDto): Promise<AdminCreateUserResponseDto> {
    const targetRole = dto.role ?? UserRole.ADMIN;

    this.assertCanInviteRole(caller, targetRole);
    this.assertValidPermissions(targetRole, caller, dto.permissions);

    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new EmailAlreadyExistsException();
    }

    const user = await this.userRepository.create({
      name: dto.name,
      email: dto.email,
      password: null,
      role: targetRole,
      permissions: dto.permissions ?? [],
      emailVerified: false,
    });

    await this.authService.issueUserInvite(user);

    return AdminUserMapper.toCreateResponse(user);
  }

  async resendInvite(caller: JwtPayload, userId: string): Promise<void> {
    const existing = await this.userRepository.findById(userId);
    if (!existing) {
      throw new UserNotFoundException();
    }

    if (existing.role !== UserRole.ADMIN && existing.role !== UserRole.STAFF) {
      throw new BadRequestException('Invitations can only be sent to Admin or Staff accounts.');
    }

    if (existing.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Cannot invite an inactive user.');
    }

    if (existing.password !== null) {
      throw new BadRequestException('User has already completed account setup.');
    }

    this.assertCanInviteRole(caller, existing.role);

    await this.authService.issueUserInvite(existing);
  }

  private assertCanInviteRole(caller: JwtPayload, targetRole: UserRole): void {
    const isMaster = caller.role === UserRole.MASTER;
    const callerPermissions = caller.permissions ?? [];

    if (targetRole === UserRole.ADMIN) {
      if (!isMaster && !callerPermissions.includes(PERMISSIONS.ADMINS_CREATE)) {
        throw new ForbiddenException(
          'Only Master or Admins with admins:create permission can invite Admin users.',
        );
      }
      return;
    }

    if (targetRole === UserRole.STAFF) {
      if (!isMaster && !callerPermissions.includes(PERMISSIONS.USERS_CREATE)) {
        throw new ForbiddenException('You do not have permission to invite staff accounts.');
      }
      return;
    }

    throw new BadRequestException('Invitations can only target Admin or Staff accounts.');
  }

  private assertValidPermissions(
    targetRole: UserRole,
    caller: JwtPayload,
    permissions?: Permission[],
  ): void {
    if (!permissions) return;

    const isMaster = caller.role === UserRole.MASTER;

    if (permissions.some((p) => MASTER_ONLY_PERMISSIONS.includes(p)) && !isMaster) {
      throw new ForbiddenException(
        'Only Master users can assign admins:create or admins:update permissions.',
      );
    }

    if (targetRole === UserRole.STAFF) {
      const hasInvalidPermission = permissions.some(
        (p) => !STAFF_ASSIGNABLE_PERMISSIONS.includes(p),
      );
      if (hasInvalidPermission) {
        throw new BadRequestException('Staff accounts can only receive operational permissions.');
      }
    }

    if (permissions.length > 0) {
      const missingDeps = findMissingPermissionDependencies(permissions);
      if (missingDeps.length > 0) {
        const details = missingDeps
          .map((d) => `Permission "${d.permission}" requires prerequisite: ${d.missing.join(', ')}`)
          .join('; ');
        throw new BadRequestException(`Missing required permission dependencies: ${details}`);
      }
    }
  }
}
