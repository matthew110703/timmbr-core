import { OAuthType, UserRole, UserStatus } from '@prisma/client';

export class AdminUserResponseDto {
  id!: string;
  name!: string;
  email!: string;
  phone!: string | null;
  role!: UserRole;
  permissions!: string[];
  status!: UserStatus;
  emailVerified!: boolean;
  hasPassword!: boolean;
  linkedProviders!: OAuthType[];
  lastLoginAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class AdminCreateUserResponseDto {
  id!: string;
  name!: string;
  email!: string;
  role!: UserRole;
  permissions!: string[];
  status!: UserStatus;
  hasPassword!: boolean;
  createdAt!: Date;
}
