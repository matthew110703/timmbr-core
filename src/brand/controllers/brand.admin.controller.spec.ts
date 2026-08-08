import { Test, TestingModule } from '@nestjs/testing';
import { BrandStatus } from '@prisma/client';
import { BrandAdminController } from './brand.admin.controller';
import { BrandService } from '../brand.service';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { GetBrandsQueryDto } from '../dto/get-brands-query.dto';

const mockBrandService = {
  getAllBrands: jest.fn(),
  getBrandById: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};

const BRAND_ID_1 = '11111111-1111-1111-1111-111111111111';

const mockBrandResponse = {
  id: BRAND_ID_1,
  name: 'Nike',
  slug: 'nike',
  status: BrandStatus.ACTIVE,
  description: 'Athletic products',
  logoUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('BrandAdminController', () => {
  let controller: BrandAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrandAdminController],
      providers: [{ provide: BrandService, useValue: mockBrandService }],
    }).compile();

    controller = module.get<BrandAdminController>(BrandAdminController);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAll', () => {
    it('delegates to service.getAllBrands', async () => {
      const query: GetBrandsQueryDto = { page: 1, limit: 10 };
      const paginatedResult = {
        data: [mockBrandResponse],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
      mockBrandService.getAllBrands.mockResolvedValue(paginatedResult);

      const result = await controller.getAll(query);

      expect(mockBrandService.getAllBrands).toHaveBeenCalledWith(query);
      expect(result).toBe(paginatedResult);
    });
  });

  describe('getBrandById', () => {
    it('delegates to service.getBrandById', async () => {
      mockBrandService.getBrandById.mockResolvedValue(mockBrandResponse);

      const result = await controller.getBrandById(BRAND_ID_1);

      expect(mockBrandService.getBrandById).toHaveBeenCalledWith(BRAND_ID_1);
      expect(result).toBe(mockBrandResponse);
    });
  });

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto: CreateBrandDto = {
        name: 'Nike',
        status: BrandStatus.ACTIVE,
      };
      mockBrandService.create.mockResolvedValue(mockBrandResponse);

      const result = await controller.create(dto);

      expect(mockBrandService.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(mockBrandResponse);
    });
  });

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto: UpdateBrandDto = { name: 'Nike Inc' };
      mockBrandService.update.mockResolvedValue(mockBrandResponse);

      const result = await controller.update(BRAND_ID_1, dto);

      expect(mockBrandService.update).toHaveBeenCalledWith(BRAND_ID_1, dto);
      expect(result).toBe(mockBrandResponse);
    });
  });

  describe('delete', () => {
    it('delegates to service.delete', async () => {
      mockBrandService.delete.mockResolvedValue(mockBrandResponse);

      const result = await controller.delete(BRAND_ID_1);

      expect(mockBrandService.delete).toHaveBeenCalledWith(BRAND_ID_1);
      expect(result).toBe(mockBrandResponse);
    });
  });
});
