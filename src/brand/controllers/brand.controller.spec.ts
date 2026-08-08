import { Test, TestingModule } from '@nestjs/testing';
import { BrandStatus } from '@prisma/client';
import { BrandController } from './brand.controller';
import { BrandService } from '../brand.service';
import { GetBrandsQueryDto } from '../dto/get-brands-query.dto';

const mockBrandService = {
  getAllBrands: jest.fn(),
  getBrandById: jest.fn(),
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

describe('BrandController', () => {
  let controller: BrandController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrandController],
      providers: [{ provide: BrandService, useValue: mockBrandService }],
    }).compile();

    controller = module.get<BrandController>(BrandController);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAll', () => {
    it('delegates to service.getAllBrands with onlyActive=true', async () => {
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

      expect(mockBrandService.getAllBrands).toHaveBeenCalledWith(query, true);
      expect(result).toBe(paginatedResult);
    });
  });

  describe('getBrandById', () => {
    it('delegates to service.getBrandById with onlyActive=true', async () => {
      mockBrandService.getBrandById.mockResolvedValue(mockBrandResponse);

      const result = await controller.getBrandById(BRAND_ID_1);

      expect(mockBrandService.getBrandById).toHaveBeenCalledWith(BRAND_ID_1, true);
      expect(result).toBe(mockBrandResponse);
    });
  });
});
