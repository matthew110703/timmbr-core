import { Test, TestingModule } from '@nestjs/testing';
import { AddressType } from '@prisma/client';
import {
  AddressAlreadyDefaultException,
  AddressForbiddenException,
  AddressLimitReachedException,
  AddressNotFoundException,
} from '@/common/exceptions/address.exception';
import { AddressService } from './address.service';
import { AddressRepository } from './address.repository';
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

const mockAddressRepository = {
  findManyByUserId: jest.fn(),
  countByUserId: jest.fn(),
  findById: jest.fn(),
  findDefaultByUserAndType: jest.fn(),
  create: jest.fn(),
  createWithNewDefault: jest.fn(),
  update: jest.fn(),
  findOldestOtherAddress: jest.fn(),
  deleteDefaultAndSetNext: jest.fn(),
  delete: jest.fn(),
  setDefault: jest.fn(),
};

describe('AddressService', () => {
  let service: AddressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AddressService, { provide: AddressRepository, useValue: mockAddressRepository }],
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
      mockAddressRepository.findManyByUserId.mockResolvedValue(addresses);

      const result = await service.getAll(USER_ID);

      expect(mockAddressRepository.findManyByUserId).toHaveBeenCalledWith(USER_ID, undefined);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ fname: 'Test', lname: 'User', isDefault: true });
    });

    it('filters by AddressType when type is provided', async () => {
      const billingAddresses = [{ ...baseAddress, type: AddressType.BILLING, isDefault: true }];
      mockAddressRepository.findManyByUserId.mockResolvedValue(billingAddresses);

      const result = await service.getAll(USER_ID, AddressType.BILLING);

      expect(mockAddressRepository.findManyByUserId).toHaveBeenCalledWith(
        USER_ID,
        AddressType.BILLING,
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(AddressType.BILLING);
    });

    it('returns an empty array when the user has no addresses', async () => {
      mockAddressRepository.findManyByUserId.mockResolvedValue([]);

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

    it('forces isDefault=true for the very first address of a given type regardless of dto.isDefault', async () => {
      const created = { ...baseAddress, isDefault: true };
      mockAddressRepository.countByUserId
        .mockResolvedValueOnce(1) // total count
        .mockResolvedValueOnce(0); // count of type SHIPPING
      mockAddressRepository.create.mockResolvedValue(created);

      const result = await service.create(USER_ID, { ...dto, isDefault: false });

      expect(mockAddressRepository.countByUserId).toHaveBeenCalledWith(
        USER_ID,
        AddressType.SHIPPING,
      );
      expect(mockAddressRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: true, type: AddressType.SHIPPING }),
      );
      expect(result.isDefault).toBe(true);
    });

    it('maintains separate defaults: first BILLING address becomes default BILLING even if user has SHIPPING addresses', async () => {
      const created = { ...baseAddress, type: AddressType.BILLING, isDefault: true };
      mockAddressRepository.countByUserId
        .mockResolvedValueOnce(2) // 2 total addresses (SHIPPING)
        .mockResolvedValueOnce(0); // 0 BILLING addresses
      mockAddressRepository.create.mockResolvedValue(created);

      const result = await service.create(USER_ID, {
        ...dto,
        type: AddressType.BILLING,
        isDefault: false,
      });

      expect(mockAddressRepository.countByUserId).toHaveBeenCalledWith(
        USER_ID,
        AddressType.BILLING,
      );
      expect(mockAddressRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: true, type: AddressType.BILLING }),
      );
      expect(result.isDefault).toBe(true);
      expect(result.type).toBe(AddressType.BILLING);
    });

    it('creates a subsequent address of the same type with isDefault=false when not requested as default', async () => {
      const created = { ...baseAddress, isDefault: false };
      mockAddressRepository.countByUserId
        .mockResolvedValueOnce(1) // total count
        .mockResolvedValueOnce(1); // count of SHIPPING
      mockAddressRepository.create.mockResolvedValue(created);

      const result = await service.create(USER_ID, { ...dto, isDefault: false });

      expect(mockAddressRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: false }),
      );
      expect(result.isDefault).toBe(false);
    });

    it('demotes only the existing default of the same type when dto.isDefault=true', async () => {
      const created = { ...baseAddress, type: AddressType.BILLING, isDefault: true };
      mockAddressRepository.countByUserId
        .mockResolvedValueOnce(3) // total count
        .mockResolvedValueOnce(1); // count of BILLING
      mockAddressRepository.createWithNewDefault.mockResolvedValue(created);

      await service.create(USER_ID, { ...dto, type: AddressType.BILLING, isDefault: true });

      expect(mockAddressRepository.createWithNewDefault).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ isDefault: true, type: AddressType.BILLING }),
        AddressType.BILLING,
      );
    });

    it('throws AddressLimitReachedException when the user already has 10 addresses', async () => {
      mockAddressRepository.countByUserId.mockResolvedValue(10);

      await expect(service.create(USER_ID, dto)).rejects.toThrow(AddressLimitReachedException);
      expect(mockAddressRepository.create).not.toHaveBeenCalled();
    });
  });

  // ─── getOne ──────────────────────────────────────────────────────────────────

  describe('getOne', () => {
    it('returns AddressResponseDto for the address owner', async () => {
      mockAddressRepository.findById.mockResolvedValue(baseAddress);

      const result = await service.getOne(USER_ID, ADDRESS_ID);

      expect(result).toMatchObject({ id: ADDRESS_ID, fname: 'Test' });
    });

    it('throws AddressNotFoundException when address does not exist', async () => {
      mockAddressRepository.findById.mockResolvedValue(null);

      await expect(service.getOne(USER_ID, ADDRESS_ID)).rejects.toThrow(AddressNotFoundException);
    });

    it('throws AddressForbiddenException when address belongs to another user', async () => {
      mockAddressRepository.findById.mockResolvedValue({
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
      mockAddressRepository.findById.mockResolvedValue(baseAddress);
      mockAddressRepository.update.mockResolvedValue(updated);

      const result = await service.update(USER_ID, ADDRESS_ID, dto);

      expect(mockAddressRepository.update).toHaveBeenCalledWith(
        ADDRESS_ID,
        expect.objectContaining({ line1: 'New Line 1' }),
      );
      expect(result).toMatchObject({ line1: 'New Line 1' });
    });

    it('throws AddressNotFoundException when address does not exist', async () => {
      mockAddressRepository.findById.mockResolvedValue(null);

      await expect(service.update(USER_ID, ADDRESS_ID, {})).rejects.toThrow(
        AddressNotFoundException,
      );
    });

    it('throws AddressForbiddenException when address belongs to another user', async () => {
      mockAddressRepository.findById.mockResolvedValue({
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
      mockAddressRepository.findById.mockResolvedValue(baseAddress); // isDefault: false
      mockAddressRepository.delete.mockResolvedValue(baseAddress);

      const result = await service.remove(USER_ID, ADDRESS_ID);

      expect(mockAddressRepository.delete).toHaveBeenCalledWith(ADDRESS_ID);
      expect(result).toEqual({ newDefaultAddressId: null });
    });

    it('promotes oldest remaining address of the same type when the deleted address was the default', async () => {
      const defaultBilling = { ...baseAddress, type: AddressType.BILLING, isDefault: true };
      const oldestRemainingBilling = {
        ...baseAddress,
        id: ADDRESS_ID_2,
        type: AddressType.BILLING,
        isDefault: false,
      };
      mockAddressRepository.findById.mockResolvedValue(defaultBilling);
      mockAddressRepository.findOldestOtherAddress.mockResolvedValue(oldestRemainingBilling);
      mockAddressRepository.deleteDefaultAndSetNext.mockResolvedValue(undefined);

      const result = await service.remove(USER_ID, ADDRESS_ID);

      expect(mockAddressRepository.findOldestOtherAddress).toHaveBeenCalledWith(
        USER_ID,
        ADDRESS_ID,
        AddressType.BILLING,
      );
      expect(mockAddressRepository.deleteDefaultAndSetNext).toHaveBeenCalledWith(
        ADDRESS_ID,
        ADDRESS_ID_2,
      );
      expect(result).toEqual({ newDefaultAddressId: ADDRESS_ID_2 });
    });

    it('returns { newDefaultAddressId: null } when deleting the last/only address of that type', async () => {
      const defaultAddress = { ...baseAddress, isDefault: true };
      mockAddressRepository.findById.mockResolvedValue(defaultAddress);
      mockAddressRepository.findOldestOtherAddress.mockResolvedValue(null);
      mockAddressRepository.deleteDefaultAndSetNext.mockResolvedValue(undefined);

      const result = await service.remove(USER_ID, ADDRESS_ID);

      expect(result).toEqual({ newDefaultAddressId: null });
    });

    it('throws AddressNotFoundException when address does not exist', async () => {
      mockAddressRepository.findById.mockResolvedValue(null);

      await expect(service.remove(USER_ID, ADDRESS_ID)).rejects.toThrow(AddressNotFoundException);
    });
  });

  // ─── setDefault ──────────────────────────────────────────────────────────────

  describe('setDefault', () => {
    it('promotes the address to default and demotes others of the same type in a transaction', async () => {
      const nonDefaultBilling = { ...baseAddress, type: AddressType.BILLING, isDefault: false };
      const promoted = { ...baseAddress, type: AddressType.BILLING, isDefault: true };
      mockAddressRepository.findById.mockResolvedValue(nonDefaultBilling);
      mockAddressRepository.setDefault.mockResolvedValue(promoted);

      const result = await service.setDefault(USER_ID, ADDRESS_ID);

      expect(mockAddressRepository.setDefault).toHaveBeenCalledWith(
        USER_ID,
        ADDRESS_ID,
        AddressType.BILLING,
      );
      expect(result.isDefault).toBe(true);
    });

    it('throws AddressAlreadyDefaultException when the address is already the default', async () => {
      mockAddressRepository.findById.mockResolvedValue({ ...baseAddress, isDefault: true });

      await expect(service.setDefault(USER_ID, ADDRESS_ID)).rejects.toThrow(
        AddressAlreadyDefaultException,
      );
    });

    it('throws AddressNotFoundException when address does not exist', async () => {
      mockAddressRepository.findById.mockResolvedValue(null);

      await expect(service.setDefault(USER_ID, ADDRESS_ID)).rejects.toThrow(
        AddressNotFoundException,
      );
    });

    it('throws AddressForbiddenException when address belongs to another user', async () => {
      mockAddressRepository.findById.mockResolvedValue({
        ...baseAddress,
        userId: OTHER_USER_ID,
      });

      await expect(service.setDefault(USER_ID, ADDRESS_ID)).rejects.toThrow(
        AddressForbiddenException,
      );
    });
  });
});
