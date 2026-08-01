import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserProfileDto } from '../dto/user-profile.dto';
import { UserMapper } from '../mappers/user.mapper';
import { UserRepository } from '../user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.userRepository.findByIdOrThrow(userId);
    return UserMapper.toProfileResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<UserProfileDto> {
    try {
      const user = await this.userRepository.update(userId, dto);
      return UserMapper.toProfileResponse(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Phone number is already in use.');
      }
      throw e;
    }
  }
}
