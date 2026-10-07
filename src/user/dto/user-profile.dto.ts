import { OAuthType, UserRole } from '@prisma/client';

export class UserProfileDto {
  id!: string;
  name!: string;
  email!: string;
  role!: UserRole;
  phone!: string | null;
  emailVerified!: boolean;
  hasPassword!: boolean;
  linkedProviders!: OAuthType[];
  lastLoginAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}
