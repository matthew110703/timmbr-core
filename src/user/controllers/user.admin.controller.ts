import { APP_ROUTES } from '@/app.routes';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles, ResponseMessage, CurrentUser, RequirePermissions } from '@/common/decorators';
import type { JwtPayload } from '@/auth/types/jwt.types';
import { PERMISSIONS } from '@/common/constants/permissions.constant';
import { UserAdminService } from '../services/user.admin.service';
import { GetAdminUsersQueryDto, GetStaffUsersQueryDto } from '../dto/get-admin-users-query.dto';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';
import { USER_ROUTES } from '../user.routes';

@Controller(`${APP_ROUTES.PREFIX.ADMIN}/${APP_ROUTES.USERS}`)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class UserAdminController {
  constructor(private readonly adminUser: UserAdminService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ResponseMessage('Users fetched successfully.')
  getAll(@Query() query: GetAdminUsersQueryDto) {
    return this.adminUser.getAll(query);
  }

  @Get(USER_ROUTES.STAFF)
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ResponseMessage('Staff users fetched successfully.')
  getStaffList(@Query() query: GetStaffUsersQueryDto) {
    return this.adminUser.getStaffList(query);
  }

  @Get(USER_ROUTES.BY_ID)
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ResponseMessage('User fetched successfully.')
  getOne(@Param('userId') userId: string) {
    return this.adminUser.getOne(userId);
  }

  @Patch(USER_ROUTES.BY_ID)
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ResponseMessage('User updated successfully.')
  update(
    @CurrentUser() caller: JwtPayload,
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.adminUser.update(caller, userId, dto);
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ResponseMessage('Invitation sent successfully.')
  create(@CurrentUser() caller: JwtPayload, @Body() dto: CreateAdminUserDto) {
    return this.adminUser.create(caller, dto);
  }

  @Post(USER_ROUTES.RESEND_INVITE)
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ResponseMessage('Invitation email resent successfully.')
  resendInvite(@CurrentUser() caller: JwtPayload, @Param('userId') userId: string) {
    return this.adminUser.resendInvite(caller, userId);
  }
}
