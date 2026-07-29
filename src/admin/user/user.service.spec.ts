import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  EmailAlreadyExistsException,
  UserNotFoundException,
} from '@/common/exceptions/user.exception';
import { AdminUserService } from './user.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { GetAdminUsersQueryDto } from './dto/get-admin-users-query.dto';

jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import * as argon2 from 'argon2';
const mockedArgon2 = jest.mocked(argon2);

const USER_ID = 'user-id-1';

const baseUser = {
  id: USER_ID,
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  name: 'Test User',
  email: 'test@example.com',
  phone: null,
  emailVerified: false,
  password: 'hashed-password',
  lastLoginAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  providers: [],
};

const mockPrismaService = {
  user: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('AdminUserService', () => {
  let service: AdminUserService;

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrismaService) => unknown) => fn(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminUserService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<AdminUserService>(AdminUserService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getAll ──────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns a paginated list of AdminUserResponseDto with default page/limit', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([baseUser]);
      mockPrismaService.user.count.mockResolvedValue(1);

      const query: GetAdminUsersQueryDto = {};
      const result = await service.getAll(query);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: { not: UserRole.MASTER } }, skip: 0, take: 20 }),
      );
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

    it('applies status and role filters to the where clause', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      const query: GetAdminUsersQueryDto = { status: UserStatus.DELETED, role: UserRole.ADMIN };
      await service.getAll(query);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: UserStatus.DELETED, role: UserRole.ADMIN },
        }),
      );
    });

    it('computes hasNextPage/hasPrevPage across multiple pages', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([baseUser]);
      mockPrismaService.user.count.mockResolvedValue(50);

      const query: GetAdminUsersQueryDto = { page: 2, limit: 20 };
      const result = await service.getAll(query);

      expect(result.meta).toEqual({
        page: 2,
        limit: 20,
        total: 50,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      });
    });
  });

  // ─── getOne ──────────────────────────────────────────────────────────────────

  describe('getOne', () => {
    it('returns AdminUserResponseDto for an existing user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.getOne(USER_ID);

      expect(result).toMatchObject({ id: USER_ID, email: 'test@example.com' });
    });

    it('throws UserNotFoundException when the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const error = await service.getOne(USER_ID).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UserNotFoundException);
      expect((error as UserNotFoundException).getResponse()).toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates user fields and returns mapped response', async () => {
      const dto: UpdateAdminUserDto = { status: UserStatus.DELETED };
      const updated = { ...baseUser, status: UserStatus.DELETED };
      mockPrismaService.user.findUnique.mockResolvedValue(baseUser);
      mockPrismaService.user.update.mockResolvedValue(updated);

      const result = await service.update(USER_ID, dto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: USER_ID }, data: dto }),
      );
      expect(result.status).toBe(UserStatus.DELETED);
    });

    it('throws UserNotFoundException when the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const error = await service.update(USER_ID, {}).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UserNotFoundException);
      expect((error as UserNotFoundException).getResponse()).toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateAdminUserDto = {
      name: 'Jane Admin',
      email: 'jane@timmbr.com',
      password: 'Secure@1234',
    };

    it('creates an ADMIN user with a hashed password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockedArgon2.hash.mockResolvedValue('hashed-value');
      const created = {
        ...baseUser,
        id: 'admin-id-1',
        role: UserRole.ADMIN,
        name: dto.name,
        email: dto.email,
      };
      mockPrismaService.user.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(mockedArgon2.hash).toHaveBeenCalledWith(dto.password);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: UserRole.ADMIN, emailVerified: true }),
        }),
      );
      expect(result).toMatchObject({ role: UserRole.ADMIN, email: dto.email });
    });

    it('throws EmailAlreadyExistsException when the email is already registered', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(baseUser);

      const error = await service.create(dto).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(EmailAlreadyExistsException);
      expect((error as EmailAlreadyExistsException).getResponse()).toMatchObject({
        code: 'EMAIL_ALREADY_EXISTS',
      });
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
  });
});
