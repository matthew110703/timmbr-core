import { Address } from '@prisma/client';
import { AddressResponseDto } from './dto/address-response.dto';

export class AddressMapper {
  static toResponse(address: Address): AddressResponseDto {
    return {
      id: address.id,
      fname: address.firstName,
      lname: address.lastName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? null,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      type: address.type,
      label: address.label,
      isDefault: address.isDefault,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}
