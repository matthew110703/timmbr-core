import { User, UserProvider } from '@/types/user';
import { UserProfileDto } from '../dto/user-profile.dto';

export class UserMapper {
  static toProfileResponse(user: User & { providers: UserProvider[] }): UserProfileDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      emailVerified: user.emailVerified,
      hasPassword: user.password !== null,
      linkedProviders: user.providers.map((p) => p.type),
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
