import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { UserNotFoundException } from '@/common/exceptions/user.exception';
import { WishlistItemAlreadyExistsException } from '@/common/exceptions/wishlist.exception';
import { WishlistRepository } from './wishlist.repository';

const USER_ID = '3f2b8c1e-7a4d-4e9b-9c2a-1d5e6f7a8b90';
const WISHLIST_ID = 'c7d9e2f1-4a6b-4c8d-9e0f-1a2b3c4d5e61';
const PRODUCT_ID = '5b7e9a1c-3d5f-4a7b-9c1d-2e4f6a8b0c13';
const VARIANT_ID = '6f1c1c4e-1b1a-4f3e-9a51-2b6a0f1f0a01';
const ITEM_ID = 'e4f6a8b0-2c4d-4e6f-8a0b-1c3d5e7f9a24';

const mockWishlist = {
  id: WISHLIST_ID,
  userId: USER_ID,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const PRISMA_ERROR_MESSAGES: Record<string, string> = {
  P2002: 'Unique constraint failed on the fields: (`wishlistId`,`variantId`)',
  P2003: 'Foreign key constraint violated on the constraint: `Wishlist_userId_fkey`',
};

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(PRISMA_ERROR_MESSAGES[code], {
    code,
    clientVersion: '7.8.0',
  });

const mockPrismaService = {
  wishlist: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  wishlistItem: {
    findUnique: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  productVariant: {
    findUnique: jest.fn(),
    count: jest.fn(),
  },
};

describe('WishlistRepository', () => {
  let repository: WishlistRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WishlistRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<WishlistRepository>(WishlistRepository);
  });

  afterEach(() => jest.resetAllMocks());

  describe('findByUserId', () => {
    it('looks up the wishlist by its unique userId', async () => {
      mockPrismaService.wishlist.findUnique.mockResolvedValue(mockWishlist);

      const result = await repository.findByUserId(USER_ID);

      expect(mockPrismaService.wishlist.findUnique).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(result).toBe(mockWishlist);
    });
  });

  describe('findWithItemsByUserId', () => {
    it('loads the wishlist by userId with items newest first', async () => {
      mockPrismaService.wishlist.findUnique.mockResolvedValue(null);

      await repository.findWithItemsByUserId(USER_ID);

      const [args] = mockPrismaService.wishlist.findUnique.mock.calls[0] as [
        { where: unknown; include: { items: { orderBy: unknown } } },
      ];
      expect(args.where).toEqual({ userId: USER_ID });
      expect(args.include.items.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  describe('findOrCreateByUserId', () => {
    it('returns the existing wishlist without writing', async () => {
      mockPrismaService.wishlist.findUnique.mockResolvedValue(mockWishlist);

      const result = await repository.findOrCreateByUserId(USER_ID);

      expect(result).toBe(mockWishlist);
      expect(mockPrismaService.wishlist.create).not.toHaveBeenCalled();
    });

    it('creates the wishlist when none exists', async () => {
      mockPrismaService.wishlist.findUnique.mockResolvedValue(null);
      mockPrismaService.wishlist.create.mockResolvedValue(mockWishlist);

      const result = await repository.findOrCreateByUserId(USER_ID);

      expect(mockPrismaService.wishlist.create).toHaveBeenCalledWith({ data: { userId: USER_ID } });
      expect(result).toBe(mockWishlist);
    });

    it('re-fetches the wishlist when a concurrent create wins the race (P2002)', async () => {
      mockPrismaService.wishlist.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockWishlist);
      mockPrismaService.wishlist.create.mockRejectedValue(prismaError('P2002'));

      const result = await repository.findOrCreateByUserId(USER_ID);

      expect(mockPrismaService.wishlist.findUnique).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockWishlist);
    });

    it('maps a missing user (P2003) to USER_NOT_FOUND', async () => {
      mockPrismaService.wishlist.findUnique.mockResolvedValue(null);
      mockPrismaService.wishlist.create.mockRejectedValue(prismaError('P2003'));

      const error = await repository.findOrCreateByUserId(USER_ID).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UserNotFoundException);
      expect((error as UserNotFoundException).getResponse()).toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });

    it('rethrows other errors', async () => {
      const error = new Error('Connection terminated unexpectedly');
      mockPrismaService.wishlist.findUnique.mockResolvedValue(null);
      mockPrismaService.wishlist.create.mockRejectedValue(error);

      await expect(repository.findOrCreateByUserId(USER_ID)).rejects.toBe(error);
    });
  });

  describe('addItem', () => {
    it('creates the item with the given wishlist, product and variant', async () => {
      const item = { id: ITEM_ID };
      mockPrismaService.wishlistItem.create.mockResolvedValue(item);

      const result = await repository.addItem(WISHLIST_ID, PRODUCT_ID, VARIANT_ID);

      expect(mockPrismaService.wishlistItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { wishlistId: WISHLIST_ID, productId: PRODUCT_ID, variantId: VARIANT_ID },
        }),
      );
      expect(result).toBe(item);
    });

    it('does not pre-check for duplicates (DB constraint is the guard)', async () => {
      mockPrismaService.wishlistItem.create.mockResolvedValue({ id: ITEM_ID });

      await repository.addItem(WISHLIST_ID, PRODUCT_ID, VARIANT_ID);

      expect(mockPrismaService.wishlistItem.findUnique).not.toHaveBeenCalled();
    });

    it('maps a unique-constraint violation (P2002) to WISHLIST_ITEM_ALREADY_EXISTS', async () => {
      mockPrismaService.wishlistItem.create.mockRejectedValue(prismaError('P2002'));

      const error = await repository
        .addItem(WISHLIST_ID, PRODUCT_ID, VARIANT_ID)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(WishlistItemAlreadyExistsException);
      expect((error as WishlistItemAlreadyExistsException).getResponse()).toMatchObject({
        code: 'WISHLIST_ITEM_ALREADY_EXISTS',
      });
    });

    it('rethrows other errors', async () => {
      const error = new Error('Connection terminated unexpectedly');
      mockPrismaService.wishlistItem.create.mockRejectedValue(error);

      await expect(repository.addItem(WISHLIST_ID, PRODUCT_ID, VARIANT_ID)).rejects.toBe(error);
    });
  });

  describe('removeItemForUser', () => {
    it("deletes only within the user's own wishlist and returns the count", async () => {
      mockPrismaService.wishlistItem.deleteMany.mockResolvedValue({ count: 1 });

      const result = await repository.removeItemForUser(USER_ID, VARIANT_ID);

      expect(mockPrismaService.wishlistItem.deleteMany).toHaveBeenCalledWith({
        where: { variantId: VARIANT_ID, wishlist: { userId: USER_ID } },
      });
      expect(result).toBe(1);
    });
  });

  describe('hasItemForUser', () => {
    it.each([
      [1, true],
      [0, false],
    ])('count %s → %s, scoped to the user', async (count, expected) => {
      mockPrismaService.wishlistItem.count.mockResolvedValue(count);

      await expect(repository.hasItemForUser(USER_ID, VARIANT_ID)).resolves.toBe(expected);
      expect(mockPrismaService.wishlistItem.count).toHaveBeenCalledWith({
        where: { variantId: VARIANT_ID, wishlist: { userId: USER_ID } },
      });
    });
  });

  describe('variantExists', () => {
    it.each([
      [1, true],
      [0, false],
    ])('count %s → %s', async (count, expected) => {
      mockPrismaService.productVariant.count.mockResolvedValue(count);

      await expect(repository.variantExists(VARIANT_ID)).resolves.toBe(expected);
      expect(mockPrismaService.productVariant.count).toHaveBeenCalledWith({
        where: { id: VARIANT_ID },
      });
    });
  });

  describe('findItem', () => {
    it('looks up by the (wishlistId, variantId) compound unique key', async () => {
      mockPrismaService.wishlistItem.findUnique.mockResolvedValue(null);

      await repository.findItem(WISHLIST_ID, VARIANT_ID);

      expect(mockPrismaService.wishlistItem.findUnique).toHaveBeenCalledWith({
        where: { wishlistId_variantId: { wishlistId: WISHLIST_ID, variantId: VARIANT_ID } },
      });
    });
  });

  describe('findVariantWithProduct', () => {
    it('loads the variant with its product id and status', async () => {
      mockPrismaService.productVariant.findUnique.mockResolvedValue(null);

      await repository.findVariantWithProduct(VARIANT_ID);

      expect(mockPrismaService.productVariant.findUnique).toHaveBeenCalledWith({
        where: { id: VARIANT_ID },
        include: { product: { select: { id: true, status: true } } },
      });
    });
  });
});
