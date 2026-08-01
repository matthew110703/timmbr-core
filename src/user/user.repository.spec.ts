import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { UserRepository } from './user.repository';

const USER_ID = '11111111-1111-1111-1111-111111111111';

const mockUser = {
  id: USER_ID,
  name: 'John Doe',
  email: 'john@example.com',
  password: 'hashedpassword',
  phone: null,
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  emailVerified: true,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  providers: [],
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrismaService) => unknown) => fn(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findById', () => {
    it('delegates to prisma.user.findUnique with providers included', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findById(USER_ID);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: USER_ID },
        include: { providers: true },
      });
      expect(result).toBe(mockUser);
    });
  });

  describe('findByIdOrThrow', () => {
    it('delegates to prisma.user.findUniqueOrThrow with providers included', async () => {
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue(mockUser);

      const result = await repository.findByIdOrThrow(USER_ID);

      expect(mockPrismaService.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: USER_ID },
        include: { providers: true },
      });
      expect(result).toBe(mockUser);
    });
  });

  describe('findByEmail', () => {
    it('delegates to prisma.user.findUnique by email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findByEmail('john@example.com');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
      });
      expect(result).toBe(mockUser);
    });
  });

  describe('findPaginated', () => {
    it('executes findMany and count in transaction', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
      mockPrismaService.user.count.mockResolvedValue(1);

      const where = { status: UserStatus.ACTIVE };
      const [data, total] = await repository.findPaginated(where, 1, 20);

      expect(data).toEqual([mockUser]);
      expect(total).toBe(1);
    });
  });

  describe('create', () => {
    it('delegates to prisma.user.create', async () => {
      const data: Prisma.UserCreateInput = {
        name: 'Admin',
        email: 'admin@example.com',
        password: 'hash',
      };
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await repository.create(data);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({ data });
      expect(result).toBe(mockUser);
    });
  });

  describe('update', () => {
    it('delegates to prisma.user.update with providers included', async () => {
      const data = { name: 'Jane Doe' };
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await repository.update(USER_ID, data);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data,
        include: { providers: true },
      });
      expect(result).toBe(mockUser);
    });
  });
});
