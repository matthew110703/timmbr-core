import { Injectable } from '@nestjs/common';
import { OAuthType, Prisma, User, UserProvider } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export type UserWithProviders = User & {
  providers: UserProvider[];
};

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

  async createEmailUser(data: Prisma.UserCreateInput): Promise<UserWithProviders> {
    return this.prisma.user.create({
      data,
      include: { providers: true },
    });
  }

  async createOAuthUserAndProvider(
    userData: Prisma.UserCreateInput,
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

  async upsertUserProvider(
    userId: string,
    type: OAuthType,
    providerUid: string,
  ): Promise<UserProvider> {
    return this.prisma.userProvider.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, providerUid },
      update: { providerUid },
    });
  }

  async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<UserWithProviders> {
    return this.prisma.user.update({
      where: { id },
      data,
      include: { providers: true },
    });
  }

  async updateLastLoginAt(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async updateEmailVerified(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }
}
