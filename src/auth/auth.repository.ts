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

  /** Matches any of the stored spellings of one number (see legacyPhoneVariants). */
  async findUserByPhoneVariants(phones: string[]): Promise<UserWithProviders | null> {
    return this.prisma.user.findFirst({
      where: { phone: { in: phones } },
      include: { providers: true },
    });
  }

  async findUserByProvider(
    type: OAuthType,
    providerUid: string,
  ): Promise<UserWithProviders | null> {
    const link = await this.prisma.userProvider.findUnique({
      where: { type_providerUid: { type, providerUid } },
      select: { user: { include: { providers: true } } },
    });
    return link?.user ?? null;
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
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
    userData: Prisma.UserCreateInput,
    type: OAuthType,
    providerUid: string,
  ): Promise<UserWithProviders> {
    return this.prisma.user.create({
      data: { ...userData, providers: { create: { type, providerUid } } },
      include: { providers: true },
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
}
