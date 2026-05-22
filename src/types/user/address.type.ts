export interface Address {
  id: string;
  userId: string;
  isDefault: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  createdAt: Date;
  updatedAt: Date;
}
