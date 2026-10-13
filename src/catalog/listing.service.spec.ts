import { Test, TestingModule } from '@nestjs/testing';
import { FilterDisplay } from '@prisma/client';
import { CategoryService } from '@/category/category.service';
import { MediaService } from '@/media/media.service';
import { RedisService } from '@/redis/redis.service';
import { CatalogCache } from './catalog-cache';
import { FacetCatalogService } from './facet-catalog.service';
import { ListingRepository } from './listing.repository';
import { ListingService } from './listing.service';
import { FacetCatalog } from './listing/listing.types';

const teak = { id: 'o-teak', code: 2, slug: 'teak', label: 'Teak', swatchHex: null };
const oak = { id: 'o-oak', code: 1, slug: 'oak', label: 'Oak', swatchHex: null };
const material = {
  id: 'd-material',
  key: 'material',
  label: 'Material',
  displayType: FilterDisplay.CHECKBOX,
  options: [teak, oak],
  optionsBySlug: new Map([
    ['teak', teak],
    ['oak', oak],
  ]),
};
const catalog: FacetCatalog = {
  definitions: [material],
  definitionsByKey: new Map([['material', material]]),
  brands: [],
  brandsBySlug: new Map(),
};

const mockRepository = {
  findPageAndAggregates: jest.fn(),
  findAggregates: jest.fn(),
  findSuggestions: jest.fn(),
};
const mockFacetCatalog = { get: jest.fn() };
const mockCategoryService = { getListingContext: jest.fn() };
const mockMediaService = { getPublicUrl: jest.fn((key: string) => `https://cdn/${key}`) };
const mockRedis = { getJson: jest.fn(), setJson: jest.fn() };

describe('ListingService', () => {
  let service: ListingService;

  beforeEach(async () => {
    mockFacetCatalog.get.mockResolvedValue(catalog);
    mockRedis.getJson.mockResolvedValue(null);
    mockRedis.setJson.mockResolvedValue('OK');
    mockRepository.findPageAndAggregates.mockResolvedValue([
      [],
      [{ kind: 'total', grp: null, id: null, n: 0, minp: null, maxp: null }],
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingService,
        { provide: ListingRepository, useValue: mockRepository },
        { provide: FacetCatalogService, useValue: mockFacetCatalog },
        { provide: CategoryService, useValue: mockCategoryService },
        { provide: MediaService, useValue: mockMediaService },
        CatalogCache,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    service = module.get(ListingService);
  });

  afterEach(() => jest.resetAllMocks());

  it('normalises the request: unknown keys/values dropped, canonical order, price swapped', async () => {
    const result = await service.getListing({
      filters: 'utm:google;material:oak,teak,granite',
      priceMin: 50000,
      priceMax: 1000,
    });

    expect(result.applied).toEqual({
      filters: 'material:oak,teak',
      sort: 'relevance',
      priceMin: 1000,
      priceMax: 50000,
    });
    const criteria = mockRepository.findPageAndAggregates.mock.calls[0][0];
    expect(criteria.groups).toEqual([{ key: 'material', kind: 'option', codes: [1, 2] }]);
  });

  it('gives equivalent requests the same cache key', async () => {
    await service.getListing({ filters: 'material:teak,oak' });
    await service.getListing({ filters: 'material:oak,teak;material:teak;junk:x' });

    const [first, second] = mockRedis.getJson.mock.calls.map(([key]: [string]) => key);
    expect(first).toMatch(/^listing:v2:[0-9a-f]{40}$/);
    expect(second).toBe(first);
  });

  it('serves a cached response without touching the database', async () => {
    mockRedis.getJson.mockResolvedValue({ total: 3 });

    const result = await service.getListing({});

    expect(result).toEqual({ total: 3 });
    expect(mockRepository.findPageAndAggregates).not.toHaveBeenCalled();
  });

  it('shares one database round trip between concurrent identical misses', async () => {
    let release!: () => void;
    mockRepository.findPageAndAggregates.mockReturnValue(
      new Promise((resolve) => {
        release = () =>
          resolve([[], [{ kind: 'total', grp: null, id: null, n: 0, minp: null, maxp: null }]]);
      }),
    );

    const requests = Promise.all([service.getListing({}), service.getListing({})]);
    await new Promise((r) => setImmediate(r));
    release();
    const [a, b] = await requests;

    expect(mockRepository.findPageAndAggregates).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('still answers when Redis is down', async () => {
    mockRedis.getJson.mockRejectedValue(new Error('ECONNREFUSED'));
    mockRedis.setJson.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.getListing({})).resolves.toMatchObject({ total: 0, products: [] });
  });

  it('resolves the category context for a category listing', async () => {
    mockCategoryService.getListingContext.mockResolvedValue({ id: 'c-1', slug: 'beds' });

    const result = await service.getListing({ category: 'beds' });

    expect(result.category).toEqual({ id: 'c-1', slug: 'beds' });
    expect(mockRepository.findPageAndAggregates.mock.calls[0][0].categoryId).toBe('c-1');
  });

  it('keeps unfiltered listings longer than filtered ones', async () => {
    await service.getListing({ category: undefined, sort: 'newest', page: 2 });
    await service.getListing({ filters: 'material:teak' });

    expect(mockRedis.setJson.mock.calls.map(([, ttl]: [string, number]) => ttl)).toEqual([300, 60]);
  });

  it('normalises the search: case and spacing never split the cache', async () => {
    const first = await service.getListing({ q: 'Teak  Bed a' });
    await service.getListing({ q: 'teak bed' });

    expect(first.applied.q).toBe('teak bed');
    expect(mockRepository.findPageAndAggregates.mock.calls[0][0].q).toBe('teak bed');
    const [a, b] = mockRedis.getJson.mock.calls.map(([key]: [string]) => key);
    expect(b).toBe(a);
  });

  it('treats a search with no usable word as no search', async () => {
    const result = await service.getListing({ q: 'a' });

    expect(result.applied.q).toBeUndefined();
    expect(mockRepository.findPageAndAggregates.mock.calls[0][0].q).toBeNull();
  });

  describe('suggest', () => {
    const row = {
      productId: 'p-1',
      slug: 'teak-bed',
      title: 'Teak Bed',
      brandName: 'Oakline',
      price: '24999.00',
      compareAtPrice: null,
      currency: 'INR',
      discountPct: 0,
      hasMultipleVariants: false,
      inStock: true,
      coverImageKey: 'img/bed.jpg',
      coverAlt: null,
    };

    it('returns nothing without querying when no word is usable', async () => {
      await expect(service.suggest({ q: ' a ' })).resolves.toEqual({ products: [] });
      expect(mockRepository.findSuggestions).not.toHaveBeenCalled();
      expect(mockRedis.getJson).not.toHaveBeenCalled();
    });

    it('maps the top matches to cards and caches them under the normalised query', async () => {
      mockRepository.findSuggestions.mockResolvedValue([row]);
      mockMediaService.getPublicUrl.mockImplementation((key: string) => `https://cdn/${key}`);

      const result = await service.suggest({ q: 'Teak BED' });

      expect(mockRepository.findSuggestions).toHaveBeenCalledWith('teak bed', 5);
      expect(result.products[0]).toMatchObject({
        slug: 'teak-bed',
        price: 24999,
        coverImage: { url: 'https://cdn/img/bed.jpg', alt: null },
      });
      const [key, ttl] = mockRedis.setJson.mock.calls[0];
      expect(key).toMatch(/^suggest:v2:[0-9a-f]{40}$/);
      expect(ttl).toBe(60);
    });

    it('serves a cached suggestion without touching the database', async () => {
      mockRedis.getJson.mockResolvedValue({ products: [] });

      await service.suggest({ q: 'teak' });

      expect(mockRepository.findSuggestions).not.toHaveBeenCalled();
    });
  });
});
