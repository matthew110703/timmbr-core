import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import { UserDeactivatedException } from '@/common/exceptions/user.exception';
import { UserService } from './user.service';
import { UserRepository } from '../user.repository';
import { UpdateUserDto } from '../dto/update-user.dto';

const USER_ID = '11111111-1111-1111-1111-111111111111';

const mockUser = {
  id: USER_ID,
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '1234567890',
  password: null,
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  emailVerified: true,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  providers: [],
};

const mockUserRepository = {
  findByIdOrThrow: jest.fn(),
  update: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: UserRepository, useValue: mockUserRepository }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('returns formatted user profile when user exists', async () => {
      mockUserRepository.findByIdOrThrow.mockResolvedValue(mockUser);

      const result = await service.getProfile(USER_ID);

      expect(mockUserRepository.findByIdOrThrow).toHaveBeenCalledWith(USER_ID);
      expect(result).toMatchObject({
        id: USER_ID,
        name: 'Jane Doe',
        email: 'jane@example.com',
        hasPassword: false,
      });
    });
  });

  it('getProfile rejects a deleted account', async () => {
    mockUserRepository.findByIdOrThrow.mockResolvedValue({
      ...mockUser,
      status: UserStatus.DELETED,
    });

    await expect(service.getProfile(USER_ID)).rejects.toThrow(UserDeactivatedException);
  });

  describe('updateProfile', () => {
    it('updates user profile successfully', async () => {
      const dto: UpdateUserDto = { name: 'Updated Jane' };
      const updatedUser = { ...mockUser, name: 'Updated Jane' };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(USER_ID, dto);

      expect(mockUserRepository.update).toHaveBeenCalledWith(USER_ID, dto);
      expect(result.name).toBe('Updated Jane');
    });
  });
});
