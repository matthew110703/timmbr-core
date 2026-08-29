import { Test, TestingModule } from '@nestjs/testing';
import { VariantStatus } from '@prisma/client';
import { VariantAdminController } from './variant.admin.controller';
import { VariantService } from '../variant.service';
import { CreateVariantDto } from '../dto/create-variant.dto';
import { UpdateVariantDto } from '../dto/update-variant.dto';
import { GetVariantsQueryDto } from '../dto/get-variants-query.dto';

const PRODUCT_ID_1 = '11111111-1111-1111-1111-111111111111';
const VARIANT_ID_1 = '22222222-2222-2222-2222-222222222222';

const mockVariantResponse = {
  id: VARIANT_ID_1,
  productId: PRODUCT_ID_1,
  sku: 'OAK-TABLE-001',
  price: 25000,
  compareAtPrice: 30000,
  currency: 'INR',
  status: VariantStatus.ACTIVE,
  isDefault: true,
  availability: {
    status: 'IN_STOCK',
    quantity: 10,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockVariantService = {
  getAllVariants: jest.fn(),
  getVariantById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

describe('VariantAdminController', () => {
  let controller: VariantAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VariantAdminController],
      providers: [{ provide: VariantService, useValue: mockVariantService }],
    }).compile();

    controller = module.get<VariantAdminController>(VariantAdminController);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAll', () => {
    it('delegates to service.getAllVariants', async () => {
      const query: GetVariantsQueryDto = { page: 1, limit: 10 };
      const paginatedResult = {
        data: [mockVariantResponse],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
      mockVariantService.getAllVariants.mockResolvedValue(paginatedResult);

      const result = await controller.getAll(PRODUCT_ID_1, query);

      expect(mockVariantService.getAllVariants).toHaveBeenCalledWith(PRODUCT_ID_1, query);
      expect(result).toBe(paginatedResult);
    });
  });

  describe('getVariantById', () => {
    it('delegates to service.getVariantById', async () => {
      mockVariantService.getVariantById.mockResolvedValue(mockVariantResponse);

      const result = await controller.getVariantById(PRODUCT_ID_1, VARIANT_ID_1);

      expect(mockVariantService.getVariantById).toHaveBeenCalledWith(PRODUCT_ID_1, VARIANT_ID_1);
      expect(result).toBe(mockVariantResponse);
    });
  });

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto: CreateVariantDto = {
        sku: 'OAK-TABLE-001',
        price: 25000,
        compareAtPrice: 30000,
        currency: 'INR',
      };
      mockVariantService.create.mockResolvedValue(mockVariantResponse);

      const result = await controller.create(PRODUCT_ID_1, dto);

      expect(mockVariantService.create).toHaveBeenCalledWith(PRODUCT_ID_1, dto);
      expect(result).toBe(mockVariantResponse);
    });
  });

  describe('patch', () => {
    it('delegates to service.update', async () => {
      const dto: UpdateVariantDto = { price: 26000 };
      mockVariantService.update.mockResolvedValue(mockVariantResponse);

      const result = await controller.patch(PRODUCT_ID_1, VARIANT_ID_1, dto);

      expect(mockVariantService.update).toHaveBeenCalledWith(PRODUCT_ID_1, VARIANT_ID_1, dto);
      expect(result).toBe(mockVariantResponse);
    });
  });

  describe('put', () => {
    it('delegates to service.update', async () => {
      const dto: UpdateVariantDto = { price: 26000 };
      mockVariantService.update.mockResolvedValue(mockVariantResponse);

      const result = await controller.put(PRODUCT_ID_1, VARIANT_ID_1, dto);

      expect(mockVariantService.update).toHaveBeenCalledWith(PRODUCT_ID_1, VARIANT_ID_1, dto);
      expect(result).toBe(mockVariantResponse);
    });
  });
});
