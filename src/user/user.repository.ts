import { Injectable } from '@nestjs/common';
import { Prisma, User, UserProvider } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export type UserWithProviders = User & {
  providers: UserProvider[];
};

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserWithProviders | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { providers: true },
    });
  }

  async findByIdOrThrow(id: string): Promise<UserWithProviders> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { providers: true },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findPaginated(
    where: Prisma.UserWhereInput,
    page: number,
    limit: number,
  ): Promise<[UserWithProviders[], number]> {
    return this.prisma.$transaction(async (tx) => {
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
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<UserWithProviders> {
    return this.prisma.user.update({
      where: { id },
      data,
      include: { providers: true },
    });
  }
}
