import { User, UserProvider } from '@/types/user';
import { AdminCreateUserResponseDto, AdminUserResponseDto } from '../dto/admin-user-response.dto';

export class AdminUserMapper {
  static toResponse(user: User & { providers: UserProvider[] }): AdminUserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      linkedProviders: user.providers.map((p) => p.type),
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static toCreateResponse(user: User): AdminCreateUserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
