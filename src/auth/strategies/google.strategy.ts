import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { env } from '@/config/env';
import { OAuthType } from '@prisma/client';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private auth: AuthService) {
    super({
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    // Only trust an email Google itself has verified; otherwise anyone could
    // sign in to an existing account by naming its address.
    const emailVerified = (profile._json as { email_verified?: boolean }).email_verified === true;

    if (!email || !emailVerified) {
      return done(new Error('Google account has no verified email address.'));
    }

    try {
      const result = await this.auth.handleOAuthLogin(
        OAuthType.GOOGLE,
        profile.id,
        email,
        profile.displayName,
      );
      done(null, result);
    } catch (err) {
      done(err as Error);
    }
  }
}
