import { OAuthType, UserRole, UserStatus } from '@prisma/client';

export class AdminUserResponseDto {
  id!: string;
  name!: string;
  email!: string;
  phone!: string | null;
  role!: UserRole;
  status!: UserStatus;
  emailVerified!: boolean;
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
  status!: UserStatus;
  createdAt!: Date;
}
