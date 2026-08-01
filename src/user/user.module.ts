import { Module } from '@nestjs/common';
import { UserController } from './controllers/user.controller';
import { UserAdminController } from './controllers/user.admin.controller';
import { UserService } from './services/user.service';
import { UserAdminService } from './services/user.admin.service';
import { UserRepository } from './user.repository';

@Module({
  controllers: [UserController, UserAdminController],
  providers: [UserService, UserAdminService, UserRepository],
  exports: [UserService, UserAdminService, UserRepository],
})
export class UserModule {}
