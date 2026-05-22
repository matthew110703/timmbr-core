import { Public, ResponseMessage } from '@/decorators';
import { Body, Controller, Post } from '@nestjs/common';
import { SignUpPayloadDto } from './dto/sign-up-dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('signup')
  @Public()
  @ResponseMessage('Registration successful. Please verify your email.')
  create(@Body() dto: SignUpPayloadDto) {
    return this.auth.signup(dto);
  }
}
