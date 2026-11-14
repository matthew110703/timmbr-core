import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import { PERMISSIONS } from '@/common/constants/permissions.constant';
import { JwtPayload } from '@/auth/types/jwt.types';
import { AuthService } from '@/auth/auth.service';
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
const CALLER_ID = '99999999-9999-9999-9999-999999999999';

const mockMasterCaller: JwtPayload = {
  sub: CALLER_ID,
  email: 'master@example.com',
  role: UserRole.MASTER,
  permissions: [],
};

const mockAdminCaller: JwtPayload = {
  sub: CALLER_ID,
  email: 'admin@example.com',
  role: UserRole.ADMIN,
  permissions: [PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_UPDATE],
};

const mockUser = {
  id: USER_ID,
  name: 'Admin User',
  email: 'admin@example.com',
  phone: null,
  password: 'hash',
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

const mockAuthService = {
  issueUserInvite: jest.fn(),
};

describe('UserAdminService', () => {
  let service: UserAdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAdminService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: AuthService, useValue: mockAuthService },
      ],
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

    it('applies case-insensitive search filter when search query is provided', async () => {
      mockUserRepository.findPaginated.mockResolvedValue([[mockUser], 1]);

      await service.getAll({ page: 1, limit: 20, search: 'arjun' });

      expect(mockUserRepository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({
          OR: [
            { name: { contains: 'arjun', mode: 'insensitive' } },
            { email: { contains: 'arjun', mode: 'insensitive' } },
            { phone: { contains: 'arjun', mode: 'insensitive' } },
          ],
        }),
        1,
        20,
      );
    });
  });

  describe('getStaffList', () => {
    it('returns paginated staff users scoped to UserRole.STAFF', async () => {
      const staffUser = { ...mockUser, role: UserRole.STAFF, permissions: ['orders:read'] };
      mockUserRepository.findPaginated.mockResolvedValue([[staffUser], 1]);

      const result = await service.getStaffList({ page: 1, limit: 10, status: UserStatus.ACTIVE });

      expect(mockUserRepository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.STAFF,
          status: UserStatus.ACTIVE,
        }),
        1,
        10,
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].role).toBe(UserRole.STAFF);
      expect(result.data[0].permissions).toEqual(['orders:read']);
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
    it('allows Master to update admin user successfully', async () => {
      const dto: UpdateAdminUserDto = { status: UserStatus.DELETED };
      const updatedUser = { ...mockUser, status: UserStatus.DELETED };
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await service.update(mockMasterCaller, USER_ID, dto);

      expect(mockUserRepository.update).toHaveBeenCalledWith(USER_ID, dto);
      expect(result.status).toBe(UserStatus.DELETED);
    });

    it('throws UserNotFoundException if target user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.update(mockMasterCaller, USER_ID, {})).rejects.toThrow(
        UserNotFoundException,
      );
    });

    it('throws ForbiddenException if attempting to update a Master account', async () => {
      mockUserRepository.findById.mockResolvedValue({ ...mockUser, role: UserRole.MASTER });

      await expect(service.update(mockMasterCaller, USER_ID, {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException if an Admin attempts to update their own permissions', async () => {
      const selfAdminCaller: JwtPayload = { ...mockAdminCaller, sub: USER_ID };
      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        service.update(selfAdminCaller, USER_ID, { permissions: [PERMISSIONS.ORDERS_READ] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if Admin without admins:update attempts to update another Admin', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(service.update(mockAdminCaller, USER_ID, { name: 'Updated' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows Admin with admins:update to update another Admin user', async () => {
      const callerWithPerm: JwtPayload = {
        ...mockAdminCaller,
        permissions: [PERMISSIONS.ADMINS_UPDATE],
      };
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue({ ...mockUser, name: 'Updated' });

      const result = await service.update(callerWithPerm, USER_ID, { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('throws ForbiddenException if non-Master attempts to assign admins:create permission', async () => {
      const callerWithPerm: JwtPayload = {
        ...mockAdminCaller,
        permissions: [PERMISSIONS.ADMINS_UPDATE],
      };
      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        service.update(callerWithPerm, USER_ID, { permissions: [PERMISSIONS.ADMINS_CREATE] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if attempting to assign administrative permissions to Staff', async () => {
      const staffUser = { ...mockUser, role: UserRole.STAFF };
      mockUserRepository.findById.mockResolvedValue(staffUser);

      await expect(
        service.update(mockMasterCaller, USER_ID, { permissions: [PERMISSIONS.USERS_CREATE] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create', () => {
    const adminDto: CreateAdminUserDto = {
      name: 'New Admin',
      email: 'newadmin@example.com',
      role: UserRole.ADMIN,
    };

    it('allows Master to invite admin user without password and sends invite email', async () => {
      const pendingUser = { ...mockUser, password: null, emailVerified: false };
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(pendingUser);

      const result = await service.create(mockMasterCaller, adminDto);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('newadmin@example.com');
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: adminDto.name,
          email: adminDto.email,
          role: UserRole.ADMIN,
          password: null,
          emailVerified: false,
        }),
      );
      expect(mockAuthService.issueUserInvite).toHaveBeenCalledWith(pendingUser);
      expect(result.hasPassword).toBe(false);
    });

    it('throws ForbiddenException if Admin without admins:create attempts to invite an Admin', async () => {
      await expect(service.create(mockAdminCaller, adminDto)).rejects.toThrow(ForbiddenException);
    });

    it('allows Admin with admins:create to invite an Admin', async () => {
      const callerWithPerm: JwtPayload = {
        ...mockAdminCaller,
        permissions: [PERMISSIONS.ADMINS_CREATE],
      };
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({ ...mockUser, password: null });

      const result = await service.create(callerWithPerm, adminDto);

      expect(result).toBeDefined();
      expect(mockAuthService.issueUserInvite).toHaveBeenCalled();
    });

    it('throws ForbiddenException if Admin attempts to assign admins:create to a new Admin', async () => {
      const callerWithPerm: JwtPayload = {
        ...mockAdminCaller,
        permissions: [PERMISSIONS.ADMINS_CREATE],
      };

      await expect(
        service.create(callerWithPerm, {
          ...adminDto,
          permissions: [PERMISSIONS.USERS_READ, PERMISSIONS.ADMINS_CREATE],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if attempting to create Staff with administrative permissions', async () => {
      const staffDto: CreateAdminUserDto = {
        name: 'New Staff',
        email: 'staff@example.com',
        role: UserRole.STAFF,
        permissions: [PERMISSIONS.USERS_READ],
      };

      await expect(service.create(mockMasterCaller, staffDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when write permission is passed without read prerequisite', async () => {
      await expect(
        service.create(mockMasterCaller, {
          ...adminDto,
          permissions: [PERMISSIONS.CATALOG_WRITE],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when orders:deliver is passed without orders:update', async () => {
      await expect(
        service.create(mockMasterCaller, {
          name: 'Staff',
          email: 'staff@example.com',
          role: UserRole.STAFF,
          permissions: [PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_DELIVER],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws EmailAlreadyExistsException if email is already registered', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.create(mockMasterCaller, adminDto)).rejects.toThrow(
        EmailAlreadyExistsException,
      );
    });
  });

  describe('resendInvite', () => {
    it('throws BadRequestException when user already completed password setup', async () => {
      mockUserRepository.findById.mockResolvedValue({ ...mockUser, password: 'hash' });

      await expect(service.resendInvite(mockMasterCaller, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('reissues invite for pending Admin user when caller is Master', async () => {
      const pending = { ...mockUser, password: null, role: UserRole.ADMIN };
      mockUserRepository.findById.mockResolvedValue(pending);

      await service.resendInvite(mockMasterCaller, USER_ID);

      expect(mockAuthService.issueUserInvite).toHaveBeenCalledWith(pending);
    });

    it('throws ForbiddenException when Admin without users:create resends Staff invite', async () => {
      const pendingStaff = { ...mockUser, password: null, role: UserRole.STAFF };
      mockUserRepository.findById.mockResolvedValue(pendingStaff);

      await expect(
        service.resendInvite(
          { ...mockAdminCaller, permissions: [PERMISSIONS.USERS_READ] },
          USER_ID,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
