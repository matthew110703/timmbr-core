import { Test, TestingModule } from '@nestjs/testing';
import { AddressType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AddressAlreadyDefaultException,
  AddressForbiddenException,
  AddressLimitReachedException,
  AddressNotFoundException,
} from '@/common/exceptions/address.exception';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

const USER_ID = 'user-id-1';
const OTHER_USER_ID = 'user-id-2';
const ADDRESS_ID = 'addr-id-1';
const ADDRESS_ID_2 = 'addr-id-2';

const baseAddress = {
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
  isDefault: false,
  latitude: null,
  longitude: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockPrismaService = {
  address: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('AddressService', () => {
  let service: AddressService;

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrismaService) => unknown) => fn(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [AddressService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<AddressService>(AddressService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getAll ──────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns a mapped list of AddressResponseDto ordered by isDefault desc', async () => {
      const addresses = [
        { ...baseAddress, isDefault: true },
        { ...baseAddress, id: ADDRESS_ID_2 },
      ];
      mockPrismaService.address.findMany.mockResolvedValue(addresses);

      const result = await service.getAll(USER_ID);

      expect(mockPrismaService.address.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ fname: 'Test', lname: 'User', isDefault: true });
    });

    it('returns an empty array when the user has no addresses', async () => {
      mockPrismaService.address.findMany.mockResolvedValue([]);

      const result = await service.getAll(USER_ID);

      expect(result).toEqual([]);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateAddressDto = {
      fname: 'Test',
      lname: 'User',
      phone: '+919876543210',
      line1: '123 Main St',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
    };

    it('forces isDefault=true for the very first address regardless of dto.isDefault', async () => {
      const created = { ...baseAddress, isDefault: true };
      mockPrismaService.address.count.mockResolvedValue(0);
      mockPrismaService.address.create.mockResolvedValue(created);

      const result = await service.create(USER_ID, { ...dto, isDefault: false });

      expect(mockPrismaService.address.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isDefault: true }) }),
      );
      expect(result.isDefault).toBe(true);
    });

    it('creates a subsequent address with isDefault=false when not requested as default', async () => {
      const created = { ...baseAddress, isDefault: false };
      mockPrismaService.address.count.mockResolvedValue(1);
      mockPrismaService.address.create.mockResolvedValue(created);

      const result = await service.create(USER_ID, { ...dto, isDefault: false });

      expect(mockPrismaService.address.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isDefault: false }) }),
      );
      expect(result.isDefault).toBe(false);
    });

    it('demotes the existing default in a transaction when dto.isDefault=true', async () => {
      const created = { ...baseAddress, isDefault: true };
      mockPrismaService.address.count.mockResolvedValue(2);
      mockPrismaService.address.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.address.create.mockResolvedValue(created);

      await service.create(USER_ID, { ...dto, isDefault: true });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.address.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, isDefault: true },
        data: { isDefault: false },
      });
      expect(mockPrismaService.address.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isDefault: true }) }),
      );
    });

    it('throws AddressLimitReachedException when the user already has 10 addresses', async () => {
      mockPrismaService.address.count.mockResolvedValue(10);

      await expect(service.create(USER_ID, dto)).rejects.toThrow(AddressLimitReachedException);
      expect(mockPrismaService.address.create).not.toHaveBeenCalled();
    });
  });

  // ─── getOne ──────────────────────────────────────────────────────────────────

  describe('getOne', () => {
    it('returns AddressResponseDto for the address owner', async () => {
      mockPrismaService.address.findUnique.mockResolvedValue(baseAddress);

      const result = await service.getOne(USER_ID, ADDRESS_ID);

      expect(result).toMatchObject({ id: ADDRESS_ID, fname: 'Test' });
    });

    it('throws AddressNotFoundException when address does not exist', async () => {
      mockPrismaService.address.findUnique.mockResolvedValue(null);

      await expect(service.getOne(USER_ID, ADDRESS_ID)).rejects.toThrow(AddressNotFoundException);
    });

    it('throws AddressForbiddenException when address belongs to another user', async () => {
      mockPrismaService.address.findUnique.mockResolvedValue({
        ...baseAddress,
        userId: OTHER_USER_ID,
      });

      await expect(service.getOne(USER_ID, ADDRESS_ID)).rejects.toThrow(AddressForbiddenException);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates address fields and returns mapped response', async () => {
      const dto: UpdateAddressDto = { line1: 'New Line 1' };
      const updated = { ...baseAddress, line1: 'New Line 1' };
      mockPrismaService.address.findUnique.mockResolvedValue(baseAddress);
      mockPrismaService.address.update.mockResolvedValue(updated);

      const result = await service.update(USER_ID, ADDRESS_ID, dto);

      expect(mockPrismaService.address.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ADDRESS_ID } }),
      );
      expect(result).toMatchObject({ line1: 'New Line 1' });
    });

    it('throws AddressNotFoundException when address does not exist', async () => {
      mockPrismaService.address.findUnique.mockResolvedValue(null);

      await expect(service.update(USER_ID, ADDRESS_ID, {})).rejects.toThrow(
        AddressNotFoundException,
      );
    });

    it('throws AddressForbiddenException when address belongs to another user', async () => {
      mockPrismaService.address.findUnique.mockResolvedValue({
        ...baseAddress,
        userId: OTHER_USER_ID,
      });

      await expect(service.update(USER_ID, ADDRESS_ID, {})).rejects.toThrow(
        AddressForbiddenException,
      );
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes a non-default address and returns { newDefaultAddressId: null }', async () => {
      mockPrismaService.address.findUnique.mockResolvedValue(baseAddress); // isDefault: false
      mockPrismaService.address.delete.mockResolvedValue(baseAddress);

      const result = await service.remove(USER_ID, ADDRESS_ID);

      expect(mockPrismaService.address.delete).toHaveBeenCalledWith({ where: { id: ADDRESS_ID } });
      expect(result).toEqual({ newDefaultAddressId: null });
    });

    it('promotes oldest remaining address when the deleted address was the default', async () => {
      const defaultAddress = { ...baseAddress, isDefault: true };
      const oldestRemaining = { ...baseAddress, id: ADDRESS_ID_2, isDefault: false };
      mockPrismaService.address.findUnique.mockResolvedValue(defaultAddress);
      mockPrismaService.address.findFirst.mockResolvedValue(oldestRemaining);
      mockPrismaService.address.update.mockResolvedValue({ ...oldestRemaining, isDefault: true });
      mockPrismaService.address.delete.mockResolvedValue(defaultAddress);

      const result = await service.remove(USER_ID, ADDRESS_ID);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.address.update).toHaveBeenCalledWith({
        where: { id: ADDRESS_ID_2 },
        data: { isDefault: true },
      });
      expect(mockPrismaService.address.delete).toHaveBeenCalledWith({ where: { id: ADDRESS_ID } });
      expect(result).toEqual({ newDefaultAddressId: ADDRESS_ID_2 });
    });

    it('returns { newDefaultAddressId: null } when deleting the last/only address', async () => {
      const defaultAddress = { ...baseAddress, isDefault: true };
      mockPrismaService.address.findUnique.mockResolvedValue(defaultAddress);
      mockPrismaService.address.findFirst.mockResolvedValue(null);
      mockPrismaService.address.delete.mockResolvedValue(defaultAddress);

      const result = await service.remove(USER_ID, ADDRESS_ID);

      expect(result).toEqual({ newDefaultAddressId: null });
    });

    it('throws AddressNotFoundException when address does not exist', async () => {
      mockPrismaService.address.findUnique.mockResolvedValue(null);

      await expect(service.remove(USER_ID, ADDRESS_ID)).rejects.toThrow(AddressNotFoundException);
    });
  });

  // ─── setDefault ──────────────────────────────────────────────────────────────

  describe('setDefault', () => {
    it('promotes the address to default and demotes others in a transaction', async () => {
      const nonDefaultAddress = { ...baseAddress, isDefault: false };
      const promoted = { ...baseAddress, isDefault: true };
      mockPrismaService.address.findUnique.mockResolvedValue(nonDefaultAddress);
      mockPrismaService.address.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.address.update.mockResolvedValue(promoted);

      const result = await service.setDefault(USER_ID, ADDRESS_ID);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.address.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, isDefault: true },
        data: { isDefault: false },
      });
      expect(mockPrismaService.address.update).toHaveBeenCalledWith({
        where: { id: ADDRESS_ID },
        data: { isDefault: true },
      });
      expect(result.isDefault).toBe(true);
    });

    it('throws AddressAlreadyDefaultException when the address is already the default', async () => {
      mockPrismaService.address.findUnique.mockResolvedValue({ ...baseAddress, isDefault: true });

      await expect(service.setDefault(USER_ID, ADDRESS_ID)).rejects.toThrow(
        AddressAlreadyDefaultException,
      );
    });

    it('throws AddressNotFoundException when address does not exist', async () => {
      mockPrismaService.address.findUnique.mockResolvedValue(null);

      await expect(service.setDefault(USER_ID, ADDRESS_ID)).rejects.toThrow(
        AddressNotFoundException,
      );
    });

    it('throws AddressForbiddenException when address belongs to another user', async () => {
      mockPrismaService.address.findUnique.mockResolvedValue({
        ...baseAddress,
        userId: OTHER_USER_ID,
      });

      await expect(service.setDefault(USER_ID, ADDRESS_ID)).rejects.toThrow(
        AddressForbiddenException,
      );
    });
  });
});
