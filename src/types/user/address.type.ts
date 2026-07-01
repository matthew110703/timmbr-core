import { AddressType } from '@prisma/client';

export { AddressType };

export interface Address {
  id: string;
  userId: string;
  isDefault: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  type: AddressType;
  label: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: Date;
  updatedAt: Date;
}
