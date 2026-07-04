import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import { AdminUserController } from './user.controller';
import { AdminUserService } from './user.service';
import { GetAdminUsersQueryDto } from './dto/get-admin-users-query.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

const mockAdminUserService: Partial<AdminUserService> = {
  getAll: jest.fn(),
  getOne: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
};

describe('AdminUserController', () => {
  let controller: AdminUserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUserController],
      providers: [{ provide: AdminUserService, useValue: mockAdminUserService }],
    }).compile();

    controller = module.get<AdminUserController>(AdminUserController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── getAll ──────────────────────────────────────────────────────────────────

  describe('getAll (GET /admin/users)', () => {
    it('calls adminUser.getAll with the query and returns the result', async () => {
      const query: GetAdminUsersQueryDto = { page: 1, limit: 20, role: UserRole.ADMIN };
      const expected = { data: [{ id: 'user-id-1' }], meta: {} };
      (mockAdminUserService.getAll as jest.Mock).mockResolvedValue(expected);

      const result = await controller.getAll(query);

      expect(mockAdminUserService.getAll).toHaveBeenCalledWith(query);
      expect(result).toBe(expected);
    });
  });

  // ─── getOne ──────────────────────────────────────────────────────────────────

  describe('getOne (GET /admin/users/:userId)', () => {
    it('calls adminUser.getOne with the userId and returns the result', async () => {
      const expected = { id: 'user-id-1' };
      (mockAdminUserService.getOne as jest.Mock).mockResolvedValue(expected);

      const result = await controller.getOne('user-id-1');

      expect(mockAdminUserService.getOne).toHaveBeenCalledWith('user-id-1');
      expect(result).toBe(expected);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update (PATCH /admin/users/:userId)', () => {
    it('calls adminUser.update with the userId and dto, returns the result', async () => {
      const dto: UpdateAdminUserDto = { status: UserStatus.DELETED };
      const expected = { id: 'user-id-1', status: UserStatus.DELETED };
      (mockAdminUserService.update as jest.Mock).mockResolvedValue(expected);

      const result = await controller.update('user-id-1', dto);

      expect(mockAdminUserService.update).toHaveBeenCalledWith('user-id-1', dto);
      expect(result).toBe(expected);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create (POST /admin/users)', () => {
    it('calls adminUser.create with the dto and returns the result', async () => {
      const dto: CreateAdminUserDto = {
        name: 'Jane Admin',
        email: 'jane@timmbr.com',
        password: 'Secure@1234',
      };
      const expected = { id: 'admin-id-1', role: UserRole.ADMIN };
      (mockAdminUserService.create as jest.Mock).mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(mockAdminUserService.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });
});
