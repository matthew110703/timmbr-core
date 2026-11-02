import { Injectable } from '@nestjs/common';
import { Address, AddressType, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AddressRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByUserId(userId: string, type?: AddressType): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: {
        userId,
        ...(type && { type }),
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async countByUserId(userId: string, type?: AddressType): Promise<number> {
    return this.prisma.address.count({
      where: {
        userId,
        ...(type && { type }),
      },
    });
  }

  async findById(id: string): Promise<Address | null> {
    return this.prisma.address.findUnique({
      where: { id },
    });
  }

  async findDefaultByUserAndType(userId: string, type: AddressType): Promise<Address | null> {
    return this.prisma.address.findFirst({
      where: { userId, type, isDefault: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    data: Prisma.AddressCreateInput | Prisma.AddressUncheckedCreateInput,
  ): Promise<Address> {
    return this.prisma.address.create({
      data,
    });
  }

  async createWithNewDefault(
    userId: string,
    data: Prisma.AddressCreateInput | Prisma.AddressUncheckedCreateInput,
    type: AddressType = AddressType.SHIPPING,
  ): Promise<Address> {
    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId, type, isDefault: true },
        data: { isDefault: false },
      });
      return tx.address.create({
        data: {
          ...data,
          type,
          isDefault: true,
        },
      });
    });
  }

  async update(
    id: string,
    data: Prisma.AddressUpdateInput | Prisma.AddressUncheckedUpdateInput,
  ): Promise<Address> {
    return this.prisma.address.update({
      where: { id },
      data,
    });
  }

  async findOldestOtherAddress(
    userId: string,
    excludeAddressId: string,
    type: AddressType = AddressType.SHIPPING,
  ): Promise<Address | null> {
    return this.prisma.address.findFirst({
      where: { userId, type, id: { not: excludeAddressId } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteDefaultAndSetNext(
    addressIdToDelete: string,
    nextDefaultId: string | null,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (nextDefaultId) {
        await tx.address.update({
          where: { id: nextDefaultId },
          data: { isDefault: true },
        });
      }
      await tx.address.delete({
        where: { id: addressIdToDelete },
      });
    });
  }

  async delete(id: string): Promise<Address> {
    return this.prisma.address.delete({
      where: { id },
    });
  }

  async setDefault(
    userId: string,
    addressId: string,
    type: AddressType = AddressType.SHIPPING,
  ): Promise<Address> {
    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId, type, isDefault: true },
        data: { isDefault: false },
      });
      return tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });
  }
}
