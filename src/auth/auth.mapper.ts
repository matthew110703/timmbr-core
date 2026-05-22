import { User } from '@/types/user';
import { SignUpResponseDto, UserShortDto } from './dto/sign-up-dto';

export class AuthMapper {
  static toSignUpResponse(
    user: User,
    tokens: { accessToken: string; refreshToken: string },
  ): SignUpResponseDto {
    const userDto: UserShortDto = {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      linkedProviders: user.providers?.map((x) => x.type) || [],
      createdAt: user.createdAt,
    };

    return {
      user: userDto,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }
}
