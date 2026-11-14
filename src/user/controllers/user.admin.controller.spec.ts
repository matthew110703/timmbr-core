import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import { JwtPayload } from '@/auth/types/jwt.types';
import { UserAdminController } from './user.admin.controller';
import { UserAdminService } from '../services/user.admin.service';
import { GetAdminUsersQueryDto } from '../dto/get-admin-users-query.dto';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';

const USER_ID = '11111111-1111-1111-1111-111111111111';

const mockCaller: JwtPayload = {
  sub: '99999999-9999-9999-9999-999999999999',
  email: 'master@example.com',
  role: UserRole.MASTER,
  permissions: [],
};

const mockUserAdminService = {
  getAll: jest.fn(),
  getStaffList: jest.fn(),
  getOne: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  resendInvite: jest.fn(),
};

const mockAdminUserResponse = {
  id: USER_ID,
  name: 'Admin User',
  email: 'admin@example.com',
  phone: null,
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
  emailVerified: true,
  linkedProviders: [],
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UserAdminController', () => {
  let controller: UserAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserAdminController],
      providers: [{ provide: UserAdminService, useValue: mockUserAdminService }],
    }).compile();

    controller = module.get<UserAdminController>(UserAdminController);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAll', () => {
    it('delegates to service.getAll', async () => {
      const query: GetAdminUsersQueryDto = { page: 1, limit: 20 };
      const paginatedResult = {
        data: [mockAdminUserResponse],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
      mockUserAdminService.getAll.mockResolvedValue(paginatedResult);

      const result = await controller.getAll(query);

      expect(mockUserAdminService.getAll).toHaveBeenCalledWith(query);
      expect(result).toBe(paginatedResult);
    });
  });

  describe('getStaffList', () => {
    it('delegates to service.getStaffList', async () => {
      const query = { page: 1, limit: 20, search: 'Arjun' };
      const paginatedResult = {
        data: [{ ...mockAdminUserResponse, role: UserRole.STAFF }],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
      mockUserAdminService.getStaffList.mockResolvedValue(paginatedResult);

      const result = await controller.getStaffList(query);

      expect(mockUserAdminService.getStaffList).toHaveBeenCalledWith(query);
      expect(result).toBe(paginatedResult);
    });
  });

  describe('getOne', () => {
    it('delegates to service.getOne', async () => {
      mockUserAdminService.getOne.mockResolvedValue(mockAdminUserResponse);

      const result = await controller.getOne(USER_ID);

      expect(mockUserAdminService.getOne).toHaveBeenCalledWith(USER_ID);
      expect(result).toBe(mockAdminUserResponse);
    });
  });

  describe('update', () => {
    it('delegates to service.update with caller', async () => {
      const dto: UpdateAdminUserDto = { status: UserStatus.DELETED };
      mockUserAdminService.update.mockResolvedValue(mockAdminUserResponse);

      const result = await controller.update(mockCaller, USER_ID, dto);

      expect(mockUserAdminService.update).toHaveBeenCalledWith(mockCaller, USER_ID, dto);
      expect(result).toBe(mockAdminUserResponse);
    });
  });

  describe('create', () => {
    it('delegates to service.create with caller', async () => {
      const dto: CreateAdminUserDto = {
        name: 'New Admin',
        email: 'newadmin@example.com',
      };
      mockUserAdminService.create.mockResolvedValue(mockAdminUserResponse);

      const result = await controller.create(mockCaller, dto);

      expect(mockUserAdminService.create).toHaveBeenCalledWith(mockCaller, dto);
      expect(result).toBe(mockAdminUserResponse);
    });
  });

  describe('resendInvite', () => {
    it('delegates to service.resendInvite with caller and userId', async () => {
      mockUserAdminService.resendInvite.mockResolvedValue(undefined);

      await controller.resendInvite(mockCaller, USER_ID);

      expect(mockUserAdminService.resendInvite).toHaveBeenCalledWith(mockCaller, USER_ID);
    });
  });
});
