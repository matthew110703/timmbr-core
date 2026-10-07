import { Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { UserDeactivatedException } from '@/common/exceptions/user.exception';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserProfileDto } from '../dto/user-profile.dto';
import { UserMapper } from '../mappers/user.mapper';
import { UserRepository } from '../user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.userRepository.findByIdOrThrow(userId);
    if (user.status === UserStatus.DELETED) throw new UserDeactivatedException();
    return UserMapper.toProfileResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<UserProfileDto> {
    const user = await this.userRepository.update(userId, dto);
    return UserMapper.toProfileResponse(user);
  }
}
