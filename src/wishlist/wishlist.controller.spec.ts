import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { UserRole } from '@prisma/client';
import { AccessTokenGuard } from '@/auth/guards/access-token.guard';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';

const USER_ID = '3f2b8c1e-7a4d-4e9b-9c2a-1d5e6f7a8b90';
const WISHLIST_ID = 'c7d9e2f1-4a6b-4c8d-9e0f-1a2b3c4d5e61';
const ITEM_ID = 'e4f6a8b0-2c4d-4e6f-8a0b-1c3d5e7f9a24';
const VARIANT_ID = '6f1c1c4e-1b1a-4f3e-9a51-2b6a0f1f0a01';

const mockWishlistService: Partial<WishlistService> = {
  getWishlist: jest.fn(),
  addItem: jest.fn(),
  removeItem: jest.fn(),
  check: jest.fn(),
};

const mockReq = (sub = USER_ID) =>
  ({
    user: { sub, email: 'customer@timmbr.com', role: UserRole.USER },
  }) as unknown as FastifyRequest;

const HANDLERS = ['getWishlist', 'addItem', 'removeItem', 'check'] as const;

describe('WishlistController', () => {
  let controller: WishlistController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WishlistController],
      providers: [{ provide: WishlistService, useValue: mockWishlistService }],
    }).compile();

    controller = module.get<WishlistController>(WishlistController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getWishlist (GET /wishlist)', () => {
    it('calls wishlist.getWishlist with the user id and returns the result', async () => {
      const expected = { id: WISHLIST_ID, items: [] };
      (mockWishlistService.getWishlist as jest.Mock).mockResolvedValue(expected);

      const result = await controller.getWishlist(mockReq());

      expect(mockWishlistService.getWishlist).toHaveBeenCalledWith(USER_ID);
      expect(result).toBe(expected);
    });
  });

  describe('addItem (POST /wishlist/items)', () => {
    it('calls wishlist.addItem with the user id and dto, returns the result', async () => {
      const dto: AddWishlistItemDto = { variantId: VARIANT_ID };
      const expected = { id: ITEM_ID, variantId: VARIANT_ID };
      (mockWishlistService.addItem as jest.Mock).mockResolvedValue(expected);

      const result = await controller.addItem(mockReq(), dto);

      expect(mockWishlistService.addItem).toHaveBeenCalledWith(USER_ID, dto);
      expect(result).toBe(expected);
    });
  });

  describe('removeItem (DELETE /wishlist/items/:variantId)', () => {
    it('calls wishlist.removeItem with the user id and variantId', async () => {
      const expected = { variantId: VARIANT_ID };
      (mockWishlistService.removeItem as jest.Mock).mockResolvedValue(expected);

      const result = await controller.removeItem(mockReq(), VARIANT_ID);

      expect(mockWishlistService.removeItem).toHaveBeenCalledWith(USER_ID, VARIANT_ID);
      expect(result).toBe(expected);
    });
  });

  describe('check (GET /wishlist/check/:variantId)', () => {
    it('calls wishlist.check with the user id and variantId', async () => {
      const expected = { inWishlist: true };
      (mockWishlistService.check as jest.Mock).mockResolvedValue(expected);

      const result = await controller.check(mockReq(), VARIANT_ID);

      expect(mockWishlistService.check).toHaveBeenCalledWith(USER_ID, VARIANT_ID);
      expect(result).toEqual({ inWishlist: true });
    });
  });

  describe('authentication', () => {
    const reflector = new Reflector();
    const guard = new AccessTokenGuard(reflector);

    const contextFor = (handler: (typeof HANDLERS)[number]) =>
      ({
        getHandler: () => WishlistController.prototype[handler],
        getClass: () => WishlistController,
      }) as unknown as ExecutionContext;

    it('no wishlist route is marked @Public() or @OptionalAuth()', () => {
      for (const handler of HANDLERS) {
        const ctx = contextFor(handler);
        expect(
          reflector.getAllAndOverride<boolean>('isPublic', [ctx.getHandler(), ctx.getClass()]),
        ).toBeFalsy();
      }
    });

    it.each(HANDLERS)('rejects unauthenticated access to %s', (handler) => {
      expect(() => guard.handleRequest(null, false, undefined, contextFor(handler))).toThrow(
        UnauthorizedException,
      );
    });
  });
});
