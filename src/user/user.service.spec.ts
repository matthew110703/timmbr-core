import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { UserService } from './user.service';

const USER_ID = 'user-id-1';

const mockUser = {
  id: USER_ID,
  role: 'USER',
  name: 'Test User',
  email: 'test@example.com',
  phone: null,
  emailVerified: true,
  password: 'hashed-password',
  lastLoginAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  providers: [],
};

const mockPrismaService = {
  user: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getProfile ──────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns a UserProfileDto for a valid userId', async () => {
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue(mockUser);

      const result = await service.getProfile(USER_ID);

      expect(mockPrismaService.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: USER_ID },
        include: { providers: true },
      });
      expect(result).toMatchObject({
        id: USER_ID,
        email: mockUser.email,
        name: mockUser.name,
        hasPassword: true,
        linkedProviders: [],
      });
    });

    it('propagates the error when findUniqueOrThrow throws (e.g. P2025 not found)', async () => {
      const notFoundError = new Error('Record not found');
      mockPrismaService.user.findUniqueOrThrow.mockRejectedValue(notFoundError);

      await expect(service.getProfile(USER_ID)).rejects.toThrow('Record not found');
    });
  });

  // ─── updateProfile ───────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('returns an updated UserProfileDto on success', async () => {
      const dto = { name: 'New Name' };
      const updatedUser = { ...mockUser, name: 'New Name', providers: [] };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(USER_ID, dto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: dto,
        include: { providers: true },
      });
      expect(result).toMatchObject({ id: USER_ID, name: 'New Name' });
    });

    it('throws ConflictException when the phone number is already in use (P2002)', async () => {
      const dto = { phone: '+919876543210' };
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      mockPrismaService.user.update.mockRejectedValue(p2002);

      await expect(service.updateProfile(USER_ID, dto)).rejects.toThrow(ConflictException);
    });

    it('rethrows unknown errors without wrapping', async () => {
      const dto = { name: 'Test' };
      const unknownError = new Error('Unexpected DB error');
      mockPrismaService.user.update.mockRejectedValue(unknownError);

      await expect(service.updateProfile(USER_ID, dto)).rejects.toThrow('Unexpected DB error');
    });
  });
});
