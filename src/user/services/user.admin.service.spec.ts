import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));
import * as argon2 from 'argon2';
const mockedArgon2 = jest.mocked(argon2);

import { UserAdminService } from './user.admin.service';
import { UserRepository } from '../user.repository';
import { GetAdminUsersQueryDto } from '../dto/get-admin-users-query.dto';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';
import {
  EmailAlreadyExistsException,
  UserNotFoundException,
} from '@/common/exceptions/user.exception';

const USER_ID = '11111111-1111-1111-1111-111111111111';

const mockUser = {
  id: USER_ID,
  name: 'Admin User',
  email: 'admin@example.com',
  phone: null,
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
  emailVerified: true,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  providers: [],
};

const mockUserRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findPaginated: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

describe('UserAdminService', () => {
  let service: UserAdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserAdminService, { provide: UserRepository, useValue: mockUserRepository }],
    }).compile();

    service = module.get<UserAdminService>(UserAdminService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAll', () => {
    it('returns paginated admin users', async () => {
      mockUserRepository.findPaginated.mockResolvedValue([[mockUser], 1]);

      const query: GetAdminUsersQueryDto = { page: 1, limit: 20 };
      const result = await service.getAll(query);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });
  });

  describe('getOne', () => {
    it('returns mapped admin user when found', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await service.getOne(USER_ID);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(USER_ID);
      expect(result.id).toBe(USER_ID);
    });

    it('throws UserNotFoundException when user is missing', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.getOne(USER_ID)).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('update', () => {
    it('updates admin user status successfully', async () => {
      const dto: UpdateAdminUserDto = { status: UserStatus.BLOCKED };
      const updatedUser = { ...mockUser, status: UserStatus.BLOCKED };
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await service.update(USER_ID, dto);

      expect(mockUserRepository.update).toHaveBeenCalledWith(USER_ID, dto);
      expect(result.status).toBe(UserStatus.BLOCKED);
    });

    it('throws UserNotFoundException if user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.update(USER_ID, {})).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('create', () => {
    const dto: CreateAdminUserDto = {
      name: 'New Admin',
      email: 'newadmin@example.com',
      password: 'Password123!',
    };

    it('creates new admin user with hashed password', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(mockUser);
      mockedArgon2.hash.mockResolvedValue('hashed_pw');

      const result = await service.create(dto);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('newadmin@example.com');
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dto.name,
          email: dto.email,
          role: UserRole.ADMIN,
          password: 'hashed_pw',
        }),
      );
      expect(result).toBeDefined();
    });

    it('throws EmailAlreadyExistsException if email is registered', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.create(dto)).rejects.toThrow(EmailAlreadyExistsException);
    });
  });
});
