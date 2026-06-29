import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { UserMapper } from './user.mapper';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { providers: true },
    });
    return UserMapper.toProfileResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<UserProfileDto> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: dto,
        include: { providers: true },
      });
      return UserMapper.toProfileResponse(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Phone number is already in use.');
      }
      throw e;
    }
  }
}
