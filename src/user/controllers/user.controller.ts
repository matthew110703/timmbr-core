import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage } from '@/common/decorators';
import { Body, Controller, Get, HttpCode, Put, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtPayload } from '@/auth/types/jwt.types';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserService } from '../services/user.service';
import { USER_ROUTES } from '../user.routes';

@Controller(APP_ROUTES.USER)
export class UserController {
  constructor(private readonly user: UserService) {}

  @Get(USER_ROUTES.ME)
  @ResponseMessage('Profile fetched successfully.')
  getProfile(@Req() req: FastifyRequest) {
    const user = req.user as unknown as JwtPayload;
    return this.user.getProfile(user.sub);
  }

  @Put(USER_ROUTES.ME)
  @HttpCode(200)
  @ResponseMessage('Profile updated successfully.')
  updateProfile(@Req() req: FastifyRequest, @Body() dto: UpdateUserDto) {
    const user = req.user as unknown as JwtPayload;
    return this.user.updateProfile(user.sub, dto);
  }
}
