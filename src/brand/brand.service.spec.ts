import { Test, TestingModule } from '@nestjs/testing';
import { BrandStatus } from '@prisma/client';
import { BrandService } from './brand.service';
import { BrandRepository } from './brand.repository';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { GetBrandsQueryDto } from './dto/get-brands-query.dto';
import {
  BrandAlreadyExistsException,
  BrandNotFoundException,
} from '@/common/exceptions/brand.exception';

const BRAND_ID_1 = '11111111-1111-1111-1111-111111111111';
const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';

const mockBrand = {
  id: BRAND_ID_1,
  name: 'Nike',
  slug: 'nike',
  status: BrandStatus.ACTIVE,
  description: 'Athletic apparel',
  logoUrl: 'http://example.com/logo.png',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const inactiveBrand = {
  ...mockBrand,
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Puma',
  status: BrandStatus.INACTIVE,
};

const mockBrandRepository = {
  findById: jest.fn(),
  findFirst: jest.fn(),
  findPaginated: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('BrandService', () => {
  let service: BrandService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BrandService, { provide: BrandRepository, useValue: mockBrandRepository }],
    }).compile();

    service = module.get<BrandService>(BrandService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateBrandDto = {
      name: 'Nike',
      status: BrandStatus.ACTIVE,
      description: 'Athletic apparel',
    };

    it('creates and returns a brand when valid dto is provided', async () => {
      mockBrandRepository.findFirst.mockResolvedValue(null);
      mockBrandRepository.create.mockResolvedValue(mockBrand);

      const result = await service.create(dto);

      expect(mockBrandRepository.findFirst).toHaveBeenCalledWith({
        name: { equals: dto.name, mode: 'insensitive' },
      });
      expect(mockBrandRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dto.name,
          slug: 'nike',
          status: BrandStatus.ACTIVE,
        }),
      );
      expect(result).toMatchObject({ id: BRAND_ID_1, name: 'Nike', slug: 'nike' });
    });

    it('throws BrandAlreadyExistsException when brand with same name exists', async () => {
      mockBrandRepository.findFirst.mockResolvedValue(mockBrand);

      await expect(service.create(dto)).rejects.toThrow(BrandAlreadyExistsException);
      expect(mockBrandRepository.create).not.toHaveBeenCalled();
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    const dto: UpdateBrandDto = { name: 'Nike International' };

    it('updates brand successfully without changing slug', async () => {
      const updatedBrand = { ...mockBrand, name: 'Nike International' };
      mockBrandRepository.findById.mockResolvedValue(mockBrand);
      mockBrandRepository.findFirst.mockResolvedValue(null);
      mockBrandRepository.update.mockResolvedValue(updatedBrand);

      const result = await service.update(BRAND_ID_1, dto);

      expect(mockBrandRepository.update).toHaveBeenCalledWith(
        BRAND_ID_1,
        expect.objectContaining({ name: 'Nike International' }),
      );
      expect(result.name).toBe('Nike International');
    });

    it('throws BrandNotFoundException when brand does not exist', async () => {
      mockBrandRepository.findById.mockResolvedValue(null);

      await expect(service.update(NON_EXISTENT_ID, dto)).rejects.toThrow(BrandNotFoundException);
    });

    it('throws BrandAlreadyExistsException when updating name to an existing brand name', async () => {
      mockBrandRepository.findById.mockResolvedValue(mockBrand);
      mockBrandRepository.findFirst.mockResolvedValue(inactiveBrand);

      await expect(service.update(BRAND_ID_1, { name: 'Puma' })).rejects.toThrow(
        BrandAlreadyExistsException,
      );
    });
  });

  // ─── getAllBrands ─────────────────────────────────────────────────────────────

  describe('getAllBrands', () => {
    it('returns paginated brands with metadata', async () => {
      const query: GetBrandsQueryDto = { page: 1, limit: 10 };
      mockBrandRepository.findPaginated.mockResolvedValue([[mockBrand], 1]);

      const result = await service.getAllBrands(query);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('forces status=ACTIVE when onlyActive=true', async () => {
      const query: GetBrandsQueryDto = { page: 1, limit: 10, status: BrandStatus.INACTIVE };
      mockBrandRepository.findPaginated.mockResolvedValue([[mockBrand], 1]);

      await service.getAllBrands(query, true);

      expect(mockBrandRepository.findPaginated).toHaveBeenCalledWith(
        { status: BrandStatus.ACTIVE },
        1,
        10,
      );
    });
  });

  // ─── getBrandById ─────────────────────────────────────────────────────────────

  describe('getBrandById', () => {
    it('returns BrandResponseDto when brand exists', async () => {
      mockBrandRepository.findById.mockResolvedValue(mockBrand);

      const result = await service.getBrandById(BRAND_ID_1);

      expect(result).toMatchObject({
        id: BRAND_ID_1,
        name: 'Nike',
      });
    });

    it('throws BrandNotFoundException when brand is missing', async () => {
      mockBrandRepository.findById.mockResolvedValue(null);

      await expect(service.getBrandById(NON_EXISTENT_ID)).rejects.toThrow(BrandNotFoundException);
    });

    it('throws BrandNotFoundException when onlyActive=true and brand is INACTIVE', async () => {
      mockBrandRepository.findById.mockResolvedValue(inactiveBrand);

      await expect(service.getBrandById(inactiveBrand.id, true)).rejects.toThrow(
        BrandNotFoundException,
      );
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes existing brand and returns mapped response', async () => {
      mockBrandRepository.findById.mockResolvedValue(mockBrand);
      mockBrandRepository.delete.mockResolvedValue(mockBrand);

      const result = await service.delete(BRAND_ID_1);

      expect(mockBrandRepository.delete).toHaveBeenCalledWith(BRAND_ID_1);
      expect(result.id).toBe(BRAND_ID_1);
    });

    it('throws BrandNotFoundException when deleting non-existent brand', async () => {
      mockBrandRepository.findById.mockResolvedValue(null);

      await expect(service.delete(NON_EXISTENT_ID)).rejects.toThrow(BrandNotFoundException);
    });
  });
});
