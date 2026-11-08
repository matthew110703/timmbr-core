import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PaginatedResult } from '@/common/types/api-response.types';
import {
  EmailAlreadyExistsException,
  UserNotFoundException,
} from '@/common/exceptions/user.exception';
import { GetAdminUsersQueryDto, GetStaffUsersQueryDto } from '../dto/get-admin-users-query.dto';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';
import { AdminCreateUserResponseDto, AdminUserResponseDto } from '../dto/admin-user-response.dto';
import { AdminUserMapper } from '../mappers/user.admin.mapper';
import { UserRepository } from '../user.repository';

@Injectable()
export class UserAdminService {
  constructor(private readonly userRepository: UserRepository) {}

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

  async update(userId: string, dto: UpdateAdminUserDto): Promise<AdminUserResponseDto> {
    const existing = await this.userRepository.findById(userId);
    if (!existing) {
      throw new UserNotFoundException();
    }

    const user = await this.userRepository.update(userId, dto);
    return AdminUserMapper.toResponse(user);
  }

  async create(dto: CreateAdminUserDto): Promise<AdminCreateUserResponseDto> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new EmailAlreadyExistsException();
    }

    const hashedPassword = await argon2.hash(dto.password);

    const user = await this.userRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: dto.role ?? UserRole.ADMIN,
      permissions: dto.permissions ?? [],
      emailVerified: true,
    });

    return AdminUserMapper.toCreateResponse(user);
  }
}
