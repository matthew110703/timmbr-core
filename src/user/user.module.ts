import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { UserController } from './controllers/user.controller';
import { UserAdminController } from './controllers/user.admin.controller';
import { UserService } from './services/user.service';
import { UserAdminService } from './services/user.admin.service';
import { UserRepository } from './user.repository';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [UserController, UserAdminController],
  providers: [UserService, UserAdminService, UserRepository],
  exports: [UserService, UserAdminService, UserRepository],
})
export class UserModule {}
