import { Module } from '@nestjs/common';
import { AdminUserController } from './user/user.controller';
import { AdminUserService } from './user/user.service';

@Module({
  controllers: [AdminUserController],
  providers: [AdminUserService],
})
export class AdminModule {}
