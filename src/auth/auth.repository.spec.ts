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
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userProvider: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('AuthRepository', () => {
  let repository: AuthRepository;

  beforeEach(async () => {
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

  describe('createEmailUser', () => {
    it('delegates to prisma.user.create with providers', async () => {
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      const userData = {
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        password: mockUser.password,
        phone: mockUser.phone,
        role: mockUser.role,
        status: mockUser.status,
        emailVerified: mockUser.emailVerified,
        lastLoginAt: mockUser.lastLoginAt,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      };

      const result = await repository.createEmailUser(userData);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: userData,
        include: { providers: true },
      });
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

  describe('createOAuthUserAndProvider', () => {
    it('creates the user and the provider link in one nested write', async () => {
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      const userData = { name: mockUser.name, email: mockUser.email, emailVerified: true };

      const result = await repository.createOAuthUserAndProvider(
        userData,
        OAuthType.GOOGLE,
        'google-uid-123',
      );

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          ...userData,
          providers: { create: { type: OAuthType.GOOGLE, providerUid: 'google-uid-123' } },
        },
        include: { providers: true },
      });
      expect(result).toBe(mockUser);
    });
  });

  describe('findUserByProvider', () => {
    it('returns the user linked to the provider identity', async () => {
      mockPrismaService.userProvider.findUnique.mockResolvedValue({ user: mockUser });

      const result = await repository.findUserByProvider(OAuthType.GOOGLE, 'google-uid-123');

      expect(mockPrismaService.userProvider.findUnique).toHaveBeenCalledWith({
        where: { type_providerUid: { type: OAuthType.GOOGLE, providerUid: 'google-uid-123' } },
        select: { user: { include: { providers: true } } },
      });
      expect(result).toBe(mockUser);
    });

    it('returns null when the provider identity is not linked', async () => {
      mockPrismaService.userProvider.findUnique.mockResolvedValue(null);

      await expect(repository.findUserByProvider(OAuthType.GOOGLE, 'x')).resolves.toBeNull();
    });
  });

  describe('findUserByPhoneVariants', () => {
    it('matches any stored spelling of the number', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      const variants = ['+919876543210', '919876543210', '9876543210'];

      const result = await repository.findUserByPhoneVariants(variants);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { phone: { in: variants } },
        include: { providers: true },
      });
      expect(result).toBe(mockUser);
    });
  });
});
