import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { OtpService } from './otp/otp.service';
import { TokenService } from './token/token.service';
import { smsServiceProvider } from './sms/sms.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { SessionCookieInterceptor } from './interceptors/SessionCookieInterceptor';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    OtpService,
    TokenService,
    smsServiceProvider,
    AccessTokenStrategy,
    RefreshTokenStrategy,
    GoogleStrategy,
    SessionCookieInterceptor,
  ],
  exports: [AuthService, AuthRepository],
})
export class AuthModule {}
