import { UserRole, UserStatus } from '@prisma/client';
import { Address } from './address.type';
import { UserProvider } from './user-provider.type';

export { UserRole, UserStatus };

export interface User {
  id: string;
  role: UserRole;
  status: UserStatus;
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
