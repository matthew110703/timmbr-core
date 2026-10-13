import { Test } from '@nestjs/testing';
import { CategoryService } from '@/category/category.service';
import { CategoryNotFoundException } from '@/common/exceptions/category.exception';
import { ProductNotFoundException } from '@/common/exceptions/product.exception';
import { MediaService } from '@/media/media.service';
import { RedisService } from '@/redis/redis.service';
import { CatalogCache } from '../catalog-cache';
import { ProductDetailRepository } from './product-detail.repository';
import { ProductDetailService } from './product-detail.service';

const row = {
  id: 'p1',
  slug: 'koto-chair',
  title: 'Koto Chair',
  shortDescription: '',
  description: null,
  brand: null,
  category: { slug: 'chairs' },
  images: [],
  attributeValues: [],
  variants: [
    {
      id: 'v1',
      sku: 'V1',
      price: 100,
      compareAtPrice: null,
      currency: 'INR',
      isDefault: true,
      inventory: { quantity: 1, reservedQuantity: 0 },
      attributeValues: [],
    },
  ],
};

describe('ProductDetailService', () => {
  const repository = { findActiveBySlug: jest.fn() };
  const categoryService = { getListingContext: jest.fn() };
  const redis = { getJson: jest.fn(), setJson: jest.fn() };
  let service: ProductDetailService;

  beforeEach(async () => {
    redis.getJson.mockResolvedValue(null);
    redis.setJson.mockResolvedValue('OK');
    categoryService.getListingContext.mockResolvedValue({
      breadcrumb: [{ name: 'Chairs', slug: 'chairs' }],
    });
    const module = await Test.createTestingModule({
      providers: [
        ProductDetailService,
        CatalogCache,
        { provide: ProductDetailRepository, useValue: repository },
        { provide: CategoryService, useValue: categoryService },
        { provide: MediaService, useValue: { getPublicUrl: (key: string) => key } },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    service = module.get(ProductDetailService);
  });

  afterEach(() => jest.resetAllMocks());

  it('builds and caches the page for a minute', async () => {
    repository.findActiveBySlug.mockResolvedValue(row);

    const result = await service.getBySlug('koto-chair');

    expect(result).toMatchObject({ slug: 'koto-chair', breadcrumb: [{ slug: 'chairs' }] });
    expect(redis.setJson).toHaveBeenCalledWith('pdp:v1:koto-chair', 60, result);
  });

  it('serves a cached page without touching the database', async () => {
    redis.getJson.mockResolvedValue({ slug: 'koto-chair' });
    await expect(service.getBySlug('koto-chair')).resolves.toEqual({ slug: 'koto-chair' });
    expect(repository.findActiveBySlug).not.toHaveBeenCalled();
  });

  it('is not found for a malformed slug, a missing product or one without variants', async () => {
    await expect(service.getBySlug('Bad Slug')).rejects.toBeInstanceOf(ProductNotFoundException);
    repository.findActiveBySlug.mockResolvedValueOnce(null);
    await expect(service.getBySlug('nope')).rejects.toBeInstanceOf(ProductNotFoundException);
    repository.findActiveBySlug.mockResolvedValueOnce({ ...row, variants: [] });
    await expect(service.getBySlug('koto-chair')).rejects.toBeInstanceOf(ProductNotFoundException);
    expect(redis.setJson).not.toHaveBeenCalled();
  });

  it('hides products in an inactive category path', async () => {
    repository.findActiveBySlug.mockResolvedValue(row);
    categoryService.getListingContext.mockRejectedValue(new CategoryNotFoundException());
    await expect(service.getBySlug('koto-chair')).rejects.toBeInstanceOf(ProductNotFoundException);
  });
});
