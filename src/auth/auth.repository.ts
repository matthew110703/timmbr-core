import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { OAuthType, Prisma, User } from '@prisma/client';
import { UserWithProviders } from '@/common/types/user';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserByEmailWithProviders(email: string): Promise<UserWithProviders | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { providers: true },
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findUserByIdWithProviders(id: string): Promise<UserWithProviders | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { providers: true },
    });
  }

  async findUserByIdOrThrow(id: string): Promise<UserWithProviders> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { providers: true },
    });
  }

  async createEmailUser(
    data: Prisma.UserCreateInput | Prisma.UserUncheckedCreateInput,
  ): Promise<UserWithProviders> {
    return this.prisma.user.create({
      data,
      include: { providers: true },
    });
  }

  async createOAuthUserAndProvider(
    userData: Prisma.UserCreateInput | Prisma.UserUncheckedCreateInput,
    type: OAuthType,
    providerUid: string,
  ): Promise<UserWithProviders> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: userData,
      });
      await tx.userProvider.create({
        data: { userId: created.id, type, providerUid },
      });
      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: { providers: true },
      });
    });
  }

  async upsertUserProvider(userId: string, type: OAuthType, providerUid: string) {
    return this.prisma.userProvider.upsert({
      where: {
        userId_type: { userId, type },
      },
      create: { userId, type, providerUid },
      update: { providerUid },
    });
  }

  async updateUser(
    id: string,
    data: Prisma.UserUpdateInput | Prisma.UserUncheckedUpdateInput,
  ): Promise<UserWithProviders> {
    return this.prisma.user.update({
      where: { id },
      data,
      include: { providers: true },
    });
  }

  async updateLastLoginAt(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async updateEmailVerified(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { emailVerified: true },
    });
  }
}
