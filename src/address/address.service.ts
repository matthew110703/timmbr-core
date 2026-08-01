import { Injectable } from '@nestjs/common';
import { Address } from '@prisma/client';
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
import { AddressRepository } from './address.repository';

const ADDRESS_LIMIT = 10;

@Injectable()
export class AddressService {
  constructor(private readonly addressRepository: AddressRepository) {}

  async getAll(userId: string): Promise<AddressResponseDto[]> {
    const addresses = await this.addressRepository.findManyByUserId(userId);
    return addresses.map((a) => AddressMapper.toResponse(a));
  }

  async create(userId: string, dto: CreateAddressDto): Promise<AddressResponseDto> {
    const count = await this.addressRepository.countByUserId(userId);
    if (count >= ADDRESS_LIMIT) throw new AddressLimitReachedException();

    const isFirst = count === 0;
    const makeDefault = isFirst || dto.isDefault === true;

    const payload = {
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
    };

    if (makeDefault && !isFirst) {
      const address = await this.addressRepository.createWithNewDefault(userId, payload);
      return AddressMapper.toResponse(address);
    }

    const address = await this.addressRepository.create(payload);
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
    const address = await this.addressRepository.update(addressId, {
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
    });
    return AddressMapper.toResponse(address);
  }

  async remove(userId: string, addressId: string): Promise<{ newDefaultAddressId: string | null }> {
    const address = await this.findOwned(userId, addressId);

    if (address.isDefault) {
      const oldest = await this.addressRepository.findOldestOtherAddress(userId, addressId);
      await this.addressRepository.deleteDefaultAndSetNext(addressId, oldest?.id ?? null);
      return { newDefaultAddressId: oldest?.id ?? null };
    }

    await this.addressRepository.delete(addressId);
    return { newDefaultAddressId: null };
  }

  async setDefault(userId: string, addressId: string): Promise<AddressResponseDto> {
    const address = await this.findOwned(userId, addressId);
    if (address.isDefault) throw new AddressAlreadyDefaultException();

    const updated = await this.addressRepository.setDefault(userId, addressId);
    return AddressMapper.toResponse(updated);
  }

  private async findOwned(userId: string, addressId: string): Promise<Address> {
    const address = await this.addressRepository.findById(addressId);
    if (!address) throw new AddressNotFoundException();
    if (address.userId !== userId) throw new AddressForbiddenException();
    return address;
  }
}
