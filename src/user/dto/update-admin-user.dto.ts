import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserStatus } from '@prisma/client';

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
}
