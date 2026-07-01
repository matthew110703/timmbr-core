import { Test, TestingModule } from '@nestjs/testing';
import type { FastifyRequest } from 'fastify';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

const mockAddressService: Partial<AddressService> = {
  getAll: jest.fn(),
  create: jest.fn(),
  getOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  setDefault: jest.fn(),
};

const mockReq = (sub = 'user-id-1') =>
  ({ user: { sub, email: 'test@example.com', role: 'USER' } }) as unknown as FastifyRequest;

describe('AddressController', () => {
  let controller: AddressController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressController],
      providers: [{ provide: AddressService, useValue: mockAddressService }],
    }).compile();

    controller = module.get<AddressController>(AddressController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── getAll ──────────────────────────────────────────────────────────────────

  describe('getAll (GET /addresses)', () => {
    it('calls address.getAll with the user id and returns the result', async () => {
      const expected = [{ id: 'addr-1' }];
      (mockAddressService.getAll as jest.Mock).mockResolvedValue(expected);

      const result = await controller.getAll(mockReq());

      expect(mockAddressService.getAll).toHaveBeenCalledWith('user-id-1');
      expect(result).toBe(expected);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create (POST /addresses)', () => {
    it('calls address.create with the user id and dto, returns the result', async () => {
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
      const expected = { id: 'addr-1', fname: 'Test' };
      (mockAddressService.create as jest.Mock).mockResolvedValue(expected);

      const result = await controller.create(mockReq(), dto);

      expect(mockAddressService.create).toHaveBeenCalledWith('user-id-1', dto);
      expect(result).toBe(expected);
    });
  });

  // ─── getOne ──────────────────────────────────────────────────────────────────

  describe('getOne (GET /addresses/:addressId)', () => {
    it('calls address.getOne with the user id and addressId, returns the result', async () => {
      const expected = { id: 'addr-id-1' };
      (mockAddressService.getOne as jest.Mock).mockResolvedValue(expected);

      const result = await controller.getOne(mockReq(), 'addr-id-1');

      expect(mockAddressService.getOne).toHaveBeenCalledWith('user-id-1', 'addr-id-1');
      expect(result).toBe(expected);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update (PUT /addresses/:addressId)', () => {
    it('calls address.update with the user id, addressId, and dto, returns the result', async () => {
      const dto: UpdateAddressDto = { line1: 'New Street' };
      const expected = { id: 'addr-id-1', line1: 'New Street' };
      (mockAddressService.update as jest.Mock).mockResolvedValue(expected);

      const result = await controller.update(mockReq(), 'addr-id-1', dto);

      expect(mockAddressService.update).toHaveBeenCalledWith('user-id-1', 'addr-id-1', dto);
      expect(result).toBe(expected);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove (DELETE /addresses/:addressId)', () => {
    it('calls address.remove with the user id and addressId, returns the result', async () => {
      const expected = { newDefaultAddressId: null };
      (mockAddressService.remove as jest.Mock).mockResolvedValue(expected);

      const result = await controller.remove(mockReq(), 'addr-id-1');

      expect(mockAddressService.remove).toHaveBeenCalledWith('user-id-1', 'addr-id-1');
      expect(result).toBe(expected);
    });
  });

  // ─── setDefault ──────────────────────────────────────────────────────────────

  describe('setDefault (PATCH /addresses/:addressId/default)', () => {
    it('calls address.setDefault with the user id and addressId, returns the result', async () => {
      const expected = { id: 'addr-id-1', isDefault: true };
      (mockAddressService.setDefault as jest.Mock).mockResolvedValue(expected);

      const result = await controller.setDefault(mockReq(), 'addr-id-1');

      expect(mockAddressService.setDefault).toHaveBeenCalledWith('user-id-1', 'addr-id-1');
      expect(result).toBe(expected);
    });
  });
});
