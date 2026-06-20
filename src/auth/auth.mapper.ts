import { MessageResult } from '@/types/api-response.types';
import { User } from '@/types/user';
import { SignUpResponseDto, UserShortDto } from './dto/sign-up-dto';
import { LoginResponseDto } from './dto/login-dto';

export class AuthMapper {
  static toSignUpResponse(
    user: User,
    tokens: { accessToken: string; refreshToken: string },
  ): MessageResult<SignUpResponseDto> {
    const userDto: UserShortDto = {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      linkedProviders: user.providers?.map((x) => x.type) || [],
      createdAt: user.createdAt,
    };

    const message = user.emailVerified
      ? 'Sign up successful.'
      : 'Sign up successful. Please verify your email.';

    return {
      message,
      data: {
        user: userDto,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  static toLoginResponse(
    user: User,
    tokens: { accessToken: string; refreshToken: string },
  ): MessageResult<LoginResponseDto> {
    const message = user.emailVerified
      ? 'Login successful. Please verify your email.'
      : 'Login successful.';

    return {
      message,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }
}
