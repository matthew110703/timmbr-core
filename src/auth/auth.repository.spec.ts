import { Test, TestingModule } from '@nestjs/testing';
import { OAuthType, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthRepository } from './auth.repository';

const USER_ID = 'user-id-1';

const mockUser = {
  id: USER_ID,
  name: 'Test User',
  email: 'test@example.com',
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

const mockUserProvider = {
  id: 'provider-1',
  userId: USER_ID,
  type: OAuthType.GOOGLE,
  providerUid: 'google-uid-123',
  createdAt: new Date(),
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userProvider: {
    create: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('AuthRepository', () => {
  let repository: AuthRepository;

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrismaService) => unknown) => fn(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<AuthRepository>(AuthRepository);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findUserByEmail', () => {
    it('delegates to prisma.user.findUnique', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findUserByEmail('test@example.com');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toBe(mockUser);
    });
  });

  describe('findUserByEmailWithProviders', () => {
    it('delegates to prisma.user.findUnique with providers included', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findUserByEmailWithProviders('test@example.com');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: { providers: true },
      });
      expect(result).toBe(mockUser);
    });
  });

  describe('findUserById', () => {
    it('delegates to prisma.user.findUnique', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findUserById(USER_ID);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: USER_ID },
      });
      expect(result).toBe(mockUser);
    });
  });

  describe('findUserByIdWithProviders', () => {
    it('delegates to prisma.user.findUnique with providers', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findUserByIdWithProviders(USER_ID);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: USER_ID },
        include: { providers: true },
      });
      expect(result).toBe(mockUser);
    });
  });

  describe('findUserByIdOrThrow', () => {
    it('delegates to prisma.user.findUniqueOrThrow', async () => {
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue(mockUser);

      const result = await repository.findUserByIdOrThrow(USER_ID);

      expect(mockPrismaService.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: USER_ID },
        include: { providers: true },
      });
      expect(result).toBe(mockUser);
    });
  });

  describe('createEmailUser', () => {
    it('delegates to prisma.user.create with providers', async () => {
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await repository.createEmailUser(mockUser);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: mockUser,
        include: { providers: true },
      });
      expect(result).toBe(mockUser);
    });
  });

  describe('createOAuthUserAndProvider', () => {
    it('creates user and provider in transaction', async () => {
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.userProvider.create.mockResolvedValue(mockUserProvider);
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue(mockUser);

      const result = await repository.createOAuthUserAndProvider(
        mockUser,
        OAuthType.GOOGLE,
        'google-uid-123',
      );

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result).toBe(mockUser);
    });
  });

  describe('upsertUserProvider', () => {
    it('delegates to prisma.userProvider.upsert', async () => {
      mockPrismaService.userProvider.upsert.mockResolvedValue(mockUserProvider);

      const result = await repository.upsertUserProvider(USER_ID, OAuthType.GOOGLE, 'google-uid');

      expect(mockPrismaService.userProvider.upsert).toHaveBeenCalledWith({
        where: { userId_type: { userId: USER_ID, type: OAuthType.GOOGLE } },
        create: { userId: USER_ID, type: OAuthType.GOOGLE, providerUid: 'google-uid' },
        update: { providerUid: 'google-uid' },
      });
      expect(result).toBe(mockUserProvider);
    });
  });

  describe('updateUser', () => {
    it('delegates to prisma.user.update with providers', async () => {
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await repository.updateUser(USER_ID, { name: 'Updated' });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { name: 'Updated' },
        include: { providers: true },
      });
      expect(result).toBe(mockUser);
    });
  });

  describe('updateLastLoginAt', () => {
    it('delegates to prisma.user.update lastLoginAt', async () => {
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await repository.updateLastLoginAt(USER_ID);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(result).toBe(mockUser);
    });
  });

  describe('updateEmailVerified', () => {
    it('delegates to prisma.user.update emailVerified=true', async () => {
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await repository.updateEmailVerified(USER_ID);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { emailVerified: true },
      });
      expect(result).toBe(mockUser);
    });
  });
});
