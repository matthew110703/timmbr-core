import {
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '@prisma/client';
import { IsStrongPassword } from '@/auth/dto/password-policy';
import { ALL_STAFF_PERMISSIONS, StaffPermission } from '@/common/constants/permissions.constant';

export class CreateAdminUserDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(3, { message: 'Name must be at least 3 characters' })
  @MaxLength(64, { message: 'Name must be at most 64 characters' })
  name!: string;

  @Transform(({ value }) => (value as string)?.toLowerCase())
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsStrongPassword()
  password!: string;

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
