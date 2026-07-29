import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';

const ALLOWED_ADMIN_QUERY_ROLES = [UserRole.USER, UserRole.ADMIN] as const;

export class GetAdminUsersQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit must be at most 100' })
  @IsOptional()
  limit?: number;

  @IsEnum(UserStatus, {
    message: `Status must be one of: ${Object.values(UserStatus).join(', ')}`,
  })
  @IsOptional()
  status?: UserStatus;

  @IsIn(ALLOWED_ADMIN_QUERY_ROLES, {
    message: `Role must be one of: ${ALLOWED_ADMIN_QUERY_ROLES.join(', ')}`,
  })
  @IsOptional()
  role?: UserRole;
}
