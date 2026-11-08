import { IsArray, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';
import { ALL_STAFF_PERMISSIONS, StaffPermission } from '@/common/constants/permissions.constant';

export class UpdateAdminUserDto {
  @IsString({ message: 'Name must be a string' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(64, { message: 'Name must be at most 64 characters' })
  @IsOptional()
  name?: string;

  @IsEnum(UserStatus, {
    message: `Status must be one of: ${Object.values(UserStatus).join(', ')}`,
  })
  @IsOptional()
  status?: UserStatus;

  @IsOptional()
  @IsIn([UserRole.ADMIN, UserRole.STAFF], {
    message: 'Role must be ADMIN or STAFF',
  })
  role?: UserRole;

  @IsOptional()
  @IsArray()
  @IsIn(ALL_STAFF_PERMISSIONS, { each: true })
  permissions?: StaffPermission[];
}
