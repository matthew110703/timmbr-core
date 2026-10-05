import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductStatus, VariantStatus } from '@prisma/client';
import { MediaService } from '@/media/media.service';
import { UserNotFoundException } from '@/common/exceptions/user.exception';
import { WishlistItemAlreadyExistsException } from '@/common/exceptions/wishlist.exception';
import { WishlistService } from './wishlist.service';
import { WishlistRepository } from './wishlist.repository';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';

const USER_A = '3f2b8c1e-7a4d-4e9b-9c2a-1d5e6f7a8b90';
const USER_B = '8a1c4e7f-2b3d-4c5e-8f9a-0b1c2d3e4f50';
const WISHLIST_A = 'c7d9e2f1-4a6b-4c8d-9e0f-1a2b3c4d5e61';
const WISHLIST_B = 'd1e3f5a7-9b2c-4d6e-8f1a-3b5c7d9e1f72';
const PRODUCT_ID = '5b7e9a1c-3d5f-4a7b-9c1d-2e4f6a8b0c13';
const VARIANT_ID = '6f1c1c4e-1b1a-4f3e-9a51-2b6a0f1f0a01';
const ITEM_ID = 'e4f6a8b0-2c4d-4e6f-8a0b-1c3d5e7f9a24';
const CLIENT_SUPPLIED_PRODUCT_ID = '9c1e3a5b-7d9f-4b1c-8e3a-5c7e9a1b3d35';
const CDN_BASE_URL = 'https://cdn.timmbr.com';
const PRIMARY_IMAGE_KEY = 'products/solid-teak-dining-chair/primary.jpg';

const makeWishlist = (id = WISHLIST_A, userId = USER_A) => ({
  id,
  userId,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
});

const makeVariant = (
  overrides: { status?: VariantStatus; productStatus?: ProductStatus } = {},
) => ({
  id: VARIANT_ID,
  productId: PRODUCT_ID,
  sku: 'TMB-CHR-TEAK-NAT',
  price: 1499,
  isDefault: true,
  status: overrides.status ?? VariantStatus.ACTIVE,
  currency: 'INR',
  compareAtPrice: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  product: { id: PRODUCT_ID, status: overrides.productStatus ?? ProductStatus.ACTIVE },
});

const makeItem = (price = 1499, stock = 5) => ({
  id: ITEM_ID,
  wishlistId: WISHLIST_A,
  productId: PRODUCT_ID,
  variantId: VARIANT_ID,
  createdAt: new Date('2026-01-02'),
  product: {
    id: PRODUCT_ID,
    title: 'Solid Teak Dining Chair',
    slug: 'solid-teak-dining-chair',
    status: ProductStatus.ACTIVE,
    images: [{ storageKey: PRIMARY_IMAGE_KEY }],
  },
  variant: {
    id: VARIANT_ID,
    productId: PRODUCT_ID,
    sku: 'TMB-CHR-TEAK-NAT',
    price,
    isDefault: true,
    status: VariantStatus.ACTIVE,
    currency: 'INR',
    compareAtPrice: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    inventory: { quantity: stock, reservedQuantity: 0 },
    attributeValues: [],
    images: [],
  },
});

const mockWishlistRepository = {
  findByUserId: jest.fn(),
  findOrCreateByUserId: jest.fn(),
  findWithItemsByUserId: jest.fn(),
  findVariantWithProduct: jest.fn(),
  variantExists: jest.fn(),
  findItem: jest.fn(),
  addItem: jest.fn(),
  removeItemForUser: jest.fn(),
  hasItemForUser: jest.fn(),
};

const mockMediaService = {
  getPublicUrl: jest.fn(),
};

describe('WishlistService', () => {
  let service: WishlistService;

  beforeEach(async () => {
    mockMediaService.getPublicUrl.mockImplementation((key: string) => `${CDN_BASE_URL}/${key}`);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistService,
        { provide: WishlistRepository, useValue: mockWishlistRepository },
        { provide: MediaService, useValue: mockMediaService },
      ],
    }).compile();

    service = module.get<WishlistService>(WishlistService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getWishlist ─────────────────────────────────────────────────────────────

  describe('getWishlist', () => {
    it('returns the authenticated user wishlist with items', async () => {
      mockWishlistRepository.findWithItemsByUserId.mockResolvedValue({
        ...makeWishlist(),
        items: [makeItem()],
      });

      const result = await service.getWishlist(USER_A);

      expect(mockWishlistRepository.findWithItemsByUserId).toHaveBeenCalledWith(USER_A);
      expect(mockWishlistRepository.findOrCreateByUserId).not.toHaveBeenCalled();
      expect(result.id).toBe(WISHLIST_A);
      expect(result.itemCount).toBe(1);
      expect(result.items[0]).toMatchObject({
        variantId: VARIANT_ID,
        productId: PRODUCT_ID,
        product: { title: 'Solid Teak Dining Chair', slug: 'solid-teak-dining-chair' },
        variant: { price: 1499, availability: { status: 'IN_STOCK', quantity: 5 } },
        thumbnail: `${CDN_BASE_URL}/${PRIMARY_IMAGE_KEY}`,
        isAvailable: true,
      });
    });

    it('lazily creates an empty wishlist on first access', async () => {
      const created = makeWishlist();
      mockWishlistRepository.findWithItemsByUserId.mockResolvedValue(null);
      mockWishlistRepository.findOrCreateByUserId.mockResolvedValue(created);

      const result = await service.getWishlist(USER_A);

      expect(mockWishlistRepository.findOrCreateByUserId).toHaveBeenCalledWith(USER_A);
      expect(result).toEqual({
        id: WISHLIST_A,
        items: [],
        itemCount: 0,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      });
    });

    it('propagates USER_NOT_FOUND when the token user no longer exists', async () => {
      mockWishlistRepository.findWithItemsByUserId.mockResolvedValue(null);
      mockWishlistRepository.findOrCreateByUserId.mockRejectedValue(new UserNotFoundException());

      const error = await service.getWishlist(USER_A).catch((e: unknown) => e);

      expect((error as NotFoundException).getResponse()).toMatchObject({ code: 'USER_NOT_FOUND' });
    });

    it('returns the current variant price rather than a stored price', async () => {
      mockWishlistRepository.findWithItemsByUserId.mockResolvedValue({
        ...makeWishlist(),
        items: [makeItem(999)],
      });

      const result = await service.getWishlist(USER_A);

      expect(result.items[0].variant.price).toBe(999);
    });

    it('keeps out-of-stock items, flagged as unavailable', async () => {
      mockWishlistRepository.findWithItemsByUserId.mockResolvedValue({
        ...makeWishlist(),
        items: [makeItem(1499, 0)],
      });

      const result = await service.getWishlist(USER_A);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].isAvailable).toBe(false);
      expect(result.items[0].variant.availability.status).toBe('OUT_OF_STOCK');
    });
  });

  // ─── addItem ─────────────────────────────────────────────────────────────────

  describe('addItem', () => {
    const dto: AddWishlistItemDto = { variantId: VARIANT_ID };

    it('adds a valid variant to the user wishlist', async () => {
      mockWishlistRepository.findVariantWithProduct.mockResolvedValue(makeVariant());
      mockWishlistRepository.findOrCreateByUserId.mockResolvedValue(makeWishlist());
      mockWishlistRepository.addItem.mockResolvedValue(makeItem());

      const result = await service.addItem(USER_A, dto);

      expect(mockWishlistRepository.findOrCreateByUserId).toHaveBeenCalledWith(USER_A);
      expect(result).toMatchObject({ variantId: VARIANT_ID, productId: PRODUCT_ID });
    });

    it('derives productId server-side from the variant relationship', async () => {
      mockWishlistRepository.findVariantWithProduct.mockResolvedValue(makeVariant());
      mockWishlistRepository.findOrCreateByUserId.mockResolvedValue(makeWishlist());
      mockWishlistRepository.addItem.mockResolvedValue(makeItem());

      // A client-supplied productId must be ignored
      await service.addItem(USER_A, {
        variantId: VARIANT_ID,
        productId: CLIENT_SUPPLIED_PRODUCT_ID,
      } as AddWishlistItemDto);

      expect(mockWishlistRepository.addItem).toHaveBeenCalledWith(
        WISHLIST_A,
        PRODUCT_ID,
        VARIANT_ID,
      );
    });

    it('rejects a nonexistent variant with VARIANT_NOT_FOUND', async () => {
      mockWishlistRepository.findVariantWithProduct.mockResolvedValue(null);

      const error = await service.addItem(USER_A, dto).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'VARIANT_NOT_FOUND',
      });
      expect(mockWishlistRepository.findOrCreateByUserId).not.toHaveBeenCalled();
      expect(mockWishlistRepository.addItem).not.toHaveBeenCalled();
    });

    it.each([
      ['hidden variant', { status: VariantStatus.HIDDEN }],
      ['discontinued variant', { status: VariantStatus.DISCONTINUED }],
      ['archived product', { productStatus: ProductStatus.ARCHIVED }],
      ['draft product', { productStatus: ProductStatus.DRAFT }],
    ])('rejects a non-storefront-visible %s', async (_label, overrides) => {
      mockWishlistRepository.findVariantWithProduct.mockResolvedValue(makeVariant(overrides));

      const error = await service.addItem(USER_A, dto).catch((e: unknown) => e);

      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'VARIANT_NOT_FOUND',
      });
      expect(mockWishlistRepository.addItem).not.toHaveBeenCalled();
    });

    it('rejects a duplicate variant with WISHLIST_ITEM_ALREADY_EXISTS', async () => {
      mockWishlistRepository.findVariantWithProduct.mockResolvedValue(makeVariant());
      mockWishlistRepository.findOrCreateByUserId.mockResolvedValue(makeWishlist());
      mockWishlistRepository.addItem.mockRejectedValue(new WishlistItemAlreadyExistsException());

      const error = await service.addItem(USER_A, dto).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'WISHLIST_ITEM_ALREADY_EXISTS',
      });
    });

    it('lets exactly one of several concurrent duplicate adds succeed', async () => {
      mockWishlistRepository.findVariantWithProduct.mockResolvedValue(makeVariant());
      mockWishlistRepository.findOrCreateByUserId.mockResolvedValue(makeWishlist());
      // Simulates the DB unique constraint: first insert wins, the rest hit P2002 → 409
      mockWishlistRepository.addItem
        .mockResolvedValueOnce(makeItem())
        .mockRejectedValue(new WishlistItemAlreadyExistsException());

      const results = await Promise.allSettled([
        service.addItem(USER_A, dto),
        service.addItem(USER_A, dto),
        service.addItem(USER_A, dto),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(rejected).toHaveLength(2);
      for (const r of rejected) {
        expect(r.reason).toBeInstanceOf(WishlistItemAlreadyExistsException);
      }
    });
  });

  // ─── removeItem ──────────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('removes an existing item, scoped to the user', async () => {
      mockWishlistRepository.removeItemForUser.mockResolvedValue(1);

      const result = await service.removeItem(USER_A, VARIANT_ID);

      expect(mockWishlistRepository.removeItemForUser).toHaveBeenCalledWith(USER_A, VARIANT_ID);
      expect(mockWishlistRepository.variantExists).not.toHaveBeenCalled();
      expect(result).toEqual({ variantId: VARIANT_ID });
    });

    it('returns WISHLIST_ITEM_NOT_FOUND when the variant is not in the wishlist', async () => {
      mockWishlistRepository.removeItemForUser.mockResolvedValue(0);
      mockWishlistRepository.variantExists.mockResolvedValue(true);

      const error = await service.removeItem(USER_A, VARIANT_ID).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'WISHLIST_ITEM_NOT_FOUND',
      });
    });

    it('does not create a wishlist when removing', async () => {
      mockWishlistRepository.removeItemForUser.mockResolvedValue(0);
      mockWishlistRepository.variantExists.mockResolvedValue(true);

      await service.removeItem(USER_A, VARIANT_ID).catch(() => undefined);

      expect(mockWishlistRepository.findOrCreateByUserId).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent variant with VARIANT_NOT_FOUND', async () => {
      mockWishlistRepository.removeItemForUser.mockResolvedValue(0);
      mockWishlistRepository.variantExists.mockResolvedValue(false);

      const error = await service.removeItem(USER_A, VARIANT_ID).catch((e: unknown) => e);

      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'VARIANT_NOT_FOUND',
      });
    });
  });

  // ─── check ───────────────────────────────────────────────────────────────────

  describe('check', () => {
    it('returns inWishlist: true when the variant is in the wishlist', async () => {
      mockWishlistRepository.variantExists.mockResolvedValue(true);
      mockWishlistRepository.hasItemForUser.mockResolvedValue(true);

      await expect(service.check(USER_A, VARIANT_ID)).resolves.toEqual({ inWishlist: true });
      expect(mockWishlistRepository.hasItemForUser).toHaveBeenCalledWith(USER_A, VARIANT_ID);
    });

    it('returns inWishlist: false when the variant is not in the wishlist', async () => {
      mockWishlistRepository.variantExists.mockResolvedValue(true);
      mockWishlistRepository.hasItemForUser.mockResolvedValue(false);

      await expect(service.check(USER_A, VARIANT_ID)).resolves.toEqual({ inWishlist: false });
    });

    it('never creates a wishlist', async () => {
      mockWishlistRepository.variantExists.mockResolvedValue(true);
      mockWishlistRepository.hasItemForUser.mockResolvedValue(false);

      await service.check(USER_A, VARIANT_ID);

      expect(mockWishlistRepository.findOrCreateByUserId).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent variant with VARIANT_NOT_FOUND', async () => {
      mockWishlistRepository.variantExists.mockResolvedValue(false);
      mockWishlistRepository.hasItemForUser.mockResolvedValue(false);

      const error = await service.check(USER_A, VARIANT_ID).catch((e: unknown) => e);

      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'VARIANT_NOT_FOUND',
      });
    });
  });

  // ─── ownership ───────────────────────────────────────────────────────────────

  describe('ownership', () => {
    // Simulated DB: only user A's wishlist contains the variant
    const owns = (userId: string) => userId === USER_A;

    beforeEach(() => {
      mockWishlistRepository.findVariantWithProduct.mockResolvedValue(makeVariant());
      mockWishlistRepository.variantExists.mockResolvedValue(true);
    });

    it("user B cannot remove an item from user A's wishlist", async () => {
      mockWishlistRepository.removeItemForUser.mockImplementation((userId: string) =>
        Promise.resolve(owns(userId) ? 1 : 0),
      );

      const error = await service.removeItem(USER_B, VARIANT_ID).catch((e: unknown) => e);

      expect(mockWishlistRepository.removeItemForUser).toHaveBeenCalledWith(USER_B, VARIANT_ID);
      expect(mockWishlistRepository.removeItemForUser).not.toHaveBeenCalledWith(USER_A, VARIANT_ID);
      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'WISHLIST_ITEM_NOT_FOUND',
      });
    });

    it("user B's check does not see user A's items", async () => {
      mockWishlistRepository.hasItemForUser.mockImplementation((userId: string) =>
        Promise.resolve(owns(userId)),
      );

      await expect(service.check(USER_B, VARIANT_ID)).resolves.toEqual({ inWishlist: false });
      expect(mockWishlistRepository.hasItemForUser).toHaveBeenCalledWith(USER_B, VARIANT_ID);
    });

    it("user B's add goes to user B's wishlist only", async () => {
      mockWishlistRepository.findOrCreateByUserId.mockResolvedValue(
        makeWishlist(WISHLIST_B, USER_B),
      );
      mockWishlistRepository.addItem.mockResolvedValue({ ...makeItem(), wishlistId: WISHLIST_B });

      await service.addItem(USER_B, { variantId: VARIANT_ID });

      expect(mockWishlistRepository.findOrCreateByUserId).toHaveBeenCalledWith(USER_B);
      expect(mockWishlistRepository.addItem).toHaveBeenCalledWith(
        WISHLIST_B,
        PRODUCT_ID,
        VARIANT_ID,
      );
    });

    it("user B's getWishlist only loads user B's wishlist", async () => {
      mockWishlistRepository.findWithItemsByUserId.mockResolvedValue({
        ...makeWishlist(WISHLIST_B, USER_B),
        items: [],
      });

      const result = await service.getWishlist(USER_B);

      expect(mockWishlistRepository.findWithItemsByUserId).toHaveBeenCalledWith(USER_B);
      expect(result.id).toBe(WISHLIST_B);
    });
  });
});
