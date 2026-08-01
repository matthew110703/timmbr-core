import { Test, TestingModule } from '@nestjs/testing';
import { AddressType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AddressRepository } from './address.repository';

const USER_ID = 'user-id-1';
const ADDRESS_ID = 'addr-id-1';
const ADDRESS_ID_2 = 'addr-id-2';

const mockAddress = {
  id: ADDRESS_ID,
  userId: USER_ID,
  firstName: 'Test',
  lastName: 'User',
  phone: '+919876543210',
  line1: '123 Main St',
  line2: null,
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
  country: 'India',
  type: AddressType.SHIPPING,
  label: 'home',
  isDefault: true,
  latitude: null,
  longitude: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockPrismaService = {
  address: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('AddressRepository', () => {
  let repository: AddressRepository;

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrismaService) => unknown) => fn(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [AddressRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<AddressRepository>(AddressRepository);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findManyByUserId', () => {
    it('delegates to prisma.address.findMany', async () => {
      mockPrismaService.address.findMany.mockResolvedValue([mockAddress]);

      const result = await repository.findManyByUserId(USER_ID);

      expect(mockPrismaService.address.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      expect(result).toEqual([mockAddress]);
    });
  });

  describe('countByUserId', () => {
    it('delegates to prisma.address.count', async () => {
      mockPrismaService.address.count.mockResolvedValue(1);

      const result = await repository.countByUserId(USER_ID);

      expect(mockPrismaService.address.count).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(result).toBe(1);
    });
  });

  describe('findById', () => {
    it('delegates to prisma.address.findUnique', async () => {
      mockPrismaService.address.findUnique.mockResolvedValue(mockAddress);

      const result = await repository.findById(ADDRESS_ID);

      expect(mockPrismaService.address.findUnique).toHaveBeenCalledWith({
        where: { id: ADDRESS_ID },
      });
      expect(result).toBe(mockAddress);
    });
  });

  describe('create', () => {
    it('delegates to prisma.address.create', async () => {
      mockPrismaService.address.create.mockResolvedValue(mockAddress);

      const result = await repository.create(mockAddress);

      expect(mockPrismaService.address.create).toHaveBeenCalledWith({ data: mockAddress });
      expect(result).toBe(mockAddress);
    });
  });

  describe('createWithNewDefault', () => {
    it('demotes existing default address and creates new address in transaction', async () => {
      mockPrismaService.address.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.address.create.mockResolvedValue(mockAddress);

      const result = await repository.createWithNewDefault(USER_ID, mockAddress);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.address.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, isDefault: true },
        data: { isDefault: false },
      });
      expect(result).toBe(mockAddress);
    });
  });

  describe('update', () => {
    it('delegates to prisma.address.update', async () => {
      mockPrismaService.address.update.mockResolvedValue(mockAddress);

      const result = await repository.update(ADDRESS_ID, { label: 'office' });

      expect(mockPrismaService.address.update).toHaveBeenCalledWith({
        where: { id: ADDRESS_ID },
        data: { label: 'office' },
      });
      expect(result).toBe(mockAddress);
    });
  });

  describe('findOldestOtherAddress', () => {
    it('delegates to prisma.address.findFirst with exclude option', async () => {
      mockPrismaService.address.findFirst.mockResolvedValue(mockAddress);

      const result = await repository.findOldestOtherAddress(USER_ID, ADDRESS_ID);

      expect(mockPrismaService.address.findFirst).toHaveBeenCalledWith({
        where: { userId: USER_ID, id: { not: ADDRESS_ID } },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toBe(mockAddress);
    });
  });

  describe('deleteDefaultAndSetNext', () => {
    it('updates next default address and deletes current default address in transaction', async () => {
      mockPrismaService.address.update.mockResolvedValue(mockAddress);
      mockPrismaService.address.delete.mockResolvedValue(mockAddress);

      await repository.deleteDefaultAndSetNext(ADDRESS_ID, ADDRESS_ID_2);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.address.update).toHaveBeenCalledWith({
        where: { id: ADDRESS_ID_2 },
        data: { isDefault: true },
      });
      expect(mockPrismaService.address.delete).toHaveBeenCalledWith({
        where: { id: ADDRESS_ID },
      });
    });
  });

  describe('setDefault', () => {
    it('demotes all default addresses and sets target address as default in transaction', async () => {
      mockPrismaService.address.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.address.update.mockResolvedValue(mockAddress);

      const result = await repository.setDefault(USER_ID, ADDRESS_ID);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.address.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, isDefault: true },
        data: { isDefault: false },
      });
      expect(mockPrismaService.address.update).toHaveBeenCalledWith({
        where: { id: ADDRESS_ID },
        data: { isDefault: true },
      });
      expect(result).toBe(mockAddress);
    });
  });
});
