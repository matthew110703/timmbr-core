import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { GoogleStrategy } from './strategies/google.strategy';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { LoginInterceptor } from './interceptors/LoginInterceptor';
import { SignupInterceptor } from './interceptors/SignupInterceptor';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    AccessTokenStrategy,
    RefreshTokenStrategy,
    GoogleStrategy,
    LoginInterceptor,
    SignupInterceptor,
  ],
  exports: [AuthService, AuthRepository],
})
export class AuthModule {}
