import { Public, ResponseMessage } from '@/decorators';
import { Body, Controller, HttpCode, Post, UseInterceptors } from '@nestjs/common';
import { SignUpPayloadDto } from './dto/sign-up-dto';
import { AuthService } from './auth.service';
import { LoginPayloadDto } from './dto/login-dto';
import { LoginIntercepter } from './interceptors/LoginInterceptor';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('signup')
  @Public()
  create(@Body() dto: SignUpPayloadDto) {
    return this.auth.signup(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @UseInterceptors(LoginIntercepter)
  @ResponseMessage('Login successful.')
  login(@Body() dto: LoginPayloadDto) {
    return this.auth.login(dto);
  }
}
