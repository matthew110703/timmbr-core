import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '@/prisma/prisma.service';
import { PaginatedResult } from '@/types/api-response.types';
import {
  EmailAlreadyExistsException,
  UserNotFoundException,
} from '@/common/exceptions/user.exception';
import { GetAdminUsersQueryDto } from './dto/get-admin-users-query.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { AdminCreateUserResponseDto, AdminUserResponseDto } from './dto/admin-user-response.dto';
import { AdminUserMapper } from './user.mapper';

@Injectable()
export class AdminUserService {
  constructor(private prisma: PrismaService) {}

  async getAll(query: GetAdminUsersQueryDto): Promise<PaginatedResult<AdminUserResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.UserWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.role && { role: query.role }),
    };

    const [users, total] = await this.prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where,
        include: { providers: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      const total = await tx.user.count({ where });
      return [users, total] as const;
    });

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

  async getOne(userId: string): Promise<AdminUserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { providers: true },
    });
    if (!user) {
      throw new UserNotFoundException();
    }
    return AdminUserMapper.toResponse(user);
  }

  async update(userId: string, dto: UpdateAdminUserDto): Promise<AdminUserResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new UserNotFoundException();
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      include: { providers: true },
    });
    return AdminUserMapper.toResponse(user);
  }

  async create(dto: CreateAdminUserDto): Promise<AdminCreateUserResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new EmailAlreadyExistsException();
    }

    const hashedPassword = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: UserRole.ADMIN,
        emailVerified: true,
      },
    });

    return AdminUserMapper.toCreateResponse(user);
  }
}
