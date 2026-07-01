import { Injectable } from '@nestjs/common';
import { Address } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AddressAlreadyDefaultException,
  AddressForbiddenException,
  AddressLimitReachedException,
  AddressNotFoundException,
} from '@/common/exceptions/address.exception';
import { AddressMapper } from './address.mapper';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressResponseDto } from './dto/address-response.dto';

const ADDRESS_LIMIT = 10;

@Injectable()
export class AddressService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string): Promise<AddressResponseDto[]> {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return addresses.map((a) => AddressMapper.toResponse(a));
  }

  async create(userId: string, dto: CreateAddressDto): Promise<AddressResponseDto> {
    const count = await this.prisma.address.count({ where: { userId } });
    if (count >= ADDRESS_LIMIT) throw new AddressLimitReachedException();

    const isFirst = count === 0;
    const makeDefault = isFirst || dto.isDefault === true;

    if (makeDefault && !isFirst) {
      const address = await this.prisma.$transaction(async (tx) => {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
        return tx.address.create({
          data: {
            userId,
            firstName: dto.fname,
            lastName: dto.lname,
            phone: dto.phone,
            line1: dto.line1,
            line2: dto.line2,
            city: dto.city,
            state: dto.state,
            postalCode: dto.postalCode,
            country: dto.country,
            isDefault: true,
            latitude: dto.latitude,
            longitude: dto.longitude,
            type: dto.type,
            label: dto.label,
          },
        });
      });
      return AddressMapper.toResponse(address);
    }

    const address = await this.prisma.address.create({
      data: {
        userId,
        firstName: dto.fname,
        lastName: dto.lname,
        phone: dto.phone,
        line1: dto.line1,
        line2: dto.line2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        isDefault: makeDefault,
        latitude: dto.latitude,
        longitude: dto.longitude,
        type: dto.type,
        label: dto.label,
      },
    });
    return AddressMapper.toResponse(address);
  }

  async getOne(userId: string, addressId: string): Promise<AddressResponseDto> {
    const address = await this.findOwned(userId, addressId);
    return AddressMapper.toResponse(address);
  }

  async update(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    await this.findOwned(userId, addressId);
    const address = await this.prisma.address.update({
      where: { id: addressId },
      data: {
        firstName: dto.fname,
        lastName: dto.lname,
        phone: dto.phone,
        line1: dto.line1,
        line2: dto.line2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        latitude: dto.latitude,
        longitude: dto.longitude,
        type: dto.type,
        label: dto.label,
      },
    });
    return AddressMapper.toResponse(address);
  }

  async remove(userId: string, addressId: string): Promise<{ newDefaultAddressId: string | null }> {
    const address = await this.findOwned(userId, addressId);

    if (address.isDefault) {
      const oldest = await this.prisma.address.findFirst({
        where: { userId, id: { not: addressId } },
        orderBy: { createdAt: 'asc' },
      });

      await this.prisma.$transaction(async (tx) => {
        if (oldest) {
          await tx.address.update({ where: { id: oldest.id }, data: { isDefault: true } });
        }
        await tx.address.delete({ where: { id: addressId } });
      });

      return { newDefaultAddressId: oldest?.id ?? null };
    }

    await this.prisma.address.delete({ where: { id: addressId } });
    return { newDefaultAddressId: null };
  }

  async setDefault(userId: string, addressId: string): Promise<AddressResponseDto> {
    const address = await this.findOwned(userId, addressId);
    if (address.isDefault) throw new AddressAlreadyDefaultException();

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
      return tx.address.update({ where: { id: addressId }, data: { isDefault: true } });
    });

    return AddressMapper.toResponse(updated);
  }

  private async findOwned(userId: string, addressId: string): Promise<Address> {
    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address) throw new AddressNotFoundException();
    if (address.userId !== userId) throw new AddressForbiddenException();
    return address;
  }
}
