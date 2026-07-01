import { AddressType } from '@prisma/client';

export class AddressResponseDto {
  id!: string;
  fname!: string;
  lname!: string;
  phone!: string;
  line1!: string;
  line2!: string | null;
  city!: string;
  state!: string;
  postalCode!: string;
  country!: string;
  type!: AddressType;
  label!: string;
  isDefault!: boolean;
  latitude!: number | null;
  longitude!: number | null;
  createdAt!: Date;
  updatedAt!: Date;
}
