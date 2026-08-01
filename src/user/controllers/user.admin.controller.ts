import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles, ResponseMessage } from '@/common/decorators';
import { UserAdminService } from '../services/user.admin.service';
import { GetAdminUsersQueryDto } from '../dto/get-admin-users-query.dto';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';

@Controller('admin/users')
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class UserAdminController {
  constructor(private readonly adminUser: UserAdminService) {}

  @Get()
  @ResponseMessage('Users fetched successfully.')
  getAll(@Query() query: GetAdminUsersQueryDto) {
    return this.adminUser.getAll(query);
  }

  @Get(':userId')
  @ResponseMessage('User fetched successfully.')
  getOne(@Param('userId') userId: string) {
    return this.adminUser.getOne(userId);
  }

  @Patch(':userId')
  @HttpCode(200)
  @ResponseMessage('User updated successfully.')
  update(@Param('userId') userId: string, @Body() dto: UpdateAdminUserDto) {
    return this.adminUser.update(userId, dto);
  }

  @Post()
  @HttpCode(201)
  @Roles(UserRole.MASTER)
  @ResponseMessage('Admin user created successfully.')
  create(@Body() dto: CreateAdminUserDto) {
    return this.adminUser.create(dto);
  }
}
