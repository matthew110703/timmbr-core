import { UserRole } from '@prisma/client';
import { Address } from './address.type';
import { UserProvider } from './user-provider.type';

export { UserRole };

export interface User {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  phone?: string | null;
  emailVerified: boolean;
  password?: string | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  providers?: UserProvider[];
  addresses?: Address[];
}
