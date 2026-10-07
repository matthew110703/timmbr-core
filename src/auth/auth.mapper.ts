import { UserRole } from '@prisma/client';
import { User } from '@/common/types/user';
import { TokenPair } from './token/token.service';

/**
 * What every successful sign-in returns. Flat for backwards compatibility with
 * the Admin Console. `refreshToken` is moved into an httpOnly cookie by
 * SessionCookieInterceptor and never reaches the client body.
 */
export interface AuthSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  accessToken: string;
  refreshToken: string;
  /** Present on OTP verification: the account was created by this sign-in. */
  isNewUser?: boolean;
  hasPassword?: boolean;
  /** Single-use token for POST /auth/password/set (new account or forgot-password). */
  passwordSetupToken?: string;
}

export class AuthMapper {
  static toSession(
    user: User,
    tokens: TokenPair,
    extra: Pick<AuthSession, 'isNewUser' | 'hasPassword' | 'passwordSetupToken'> = {},
  ): AuthSession {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      ...extra,
    };
  }
}
