import { AddressType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class GetAddressesQueryDto {
  @IsOptional()
  @IsEnum(AddressType, { message: 'Type must be SHIPPING or BILLING' })
  type?: AddressType;
}
