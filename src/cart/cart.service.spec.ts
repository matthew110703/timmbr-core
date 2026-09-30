import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { CartRepository } from './cart.repository';
import { CartRedisRepository } from './cart-redis.repository';
import { CartPricingSync } from './cart.pricing-sync';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CartItemNotFoundException,
  CartVariantUnavailableException,
} from '@/common/exceptions/cart.exception';
import { ProductStatus, VariantStatus } from '@prisma/client';
import { RedisCart } from './types/cart.types';

describe('CartService', () => {
  let service: CartService;
  let prisma: jest.Mocked<any>;
  let cartRepository: jest.Mocked<any>;
  let cartRedisRepository: jest.Mocked<any>;
  let cartPricingSync: jest.Mocked<any>;

  const mockActiveVariant = {
    id: 'var-1',
    productId: 'prod-1',
    sku: 'SKU-001',
    price: 1500,
    status: VariantStatus.ACTIVE,
    product: {
      id: 'prod-1',
      title: 'Timmbr Chair',
      status: ProductStatus.ACTIVE,
      gstRate: 18,
    },
  };

  beforeEach(async () => {
    prisma = {
      productVariant: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    cartRepository = {
      findActiveCartByUserId: jest.fn(),
      findOrCreateCart: jest.fn(),
      upsertCartItem: jest.fn(),
      updateCartItemQuantity: jest.fn(),
      deleteCartItem: jest.fn(),
      clearCart: jest.fn(),
      syncPricesBatch: jest.fn(),
      executeInTransaction: jest.fn(),
    };

    cartRedisRepository = {
      getGuestCart: jest.fn(),
      saveGuestCart: jest.fn(),
      deleteGuestCart: jest.fn(),
    };

    cartPricingSync = {
      syncAndEnrichItems: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: prisma },
        { provide: CartRepository, useValue: cartRepository },
        { provide: CartRedisRepository, useValue: cartRedisRepository },
        { provide: CartPricingSync, useValue: cartPricingSync },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  describe('getCart', () => {
    it('should return empty cart if guest has no cookie', async () => {
      const result = await service.getCart({ userId: null, guestCartId: null });

      expect(result).toEqual({
        id: null,
        items: [],
        subtotal: '0.00',
        grandTotal: '0.00',
        currency: 'INR',
      });
    });

    it('should return empty cart if guest cart not found in Redis', async () => {
      cartRedisRepository.getGuestCart.mockResolvedValue(null);

      const result = await service.getCart({ userId: null, guestCartId: 'non-existent' });

      expect(result.id).toBeNull();
      expect(result.items).toHaveLength(0);
    });

    it('should return hydrated guest cart from Redis', async () => {
      const mockRedisCart: RedisCart = {
        id: 'guest-1',
        status: 'ACTIVE',
        subtotal: '1500.00',
        grandTotal: '1500.00',
        currency: 'INR',
        items: [
          {
            id: 'item-1',
            cartId: 'guest-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 1,
            unitPrice: '1500.00',
            totalPrice: '1500.00',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      cartRedisRepository.getGuestCart.mockResolvedValue(mockRedisCart);
      cartPricingSync.syncAndEnrichItems.mockResolvedValue({
        items: [
          {
            id: 'item-1',
            cartId: 'guest-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 1,
            unitPrice: '1500.00',
            totalPrice: '1500.00',
            currency: 'INR',
            thumbnail: null,
            isAvailable: true,
            availableQuantity: 5,
          },
        ],
        subtotal: '1500.00',
        grandTotal: '1500.00',
        currency: 'INR',
        hasDrift: false,
        driftUpdates: [],
      });

      const result = await service.getCart({ userId: null, guestCartId: 'guest-1' });

      expect(result.id).toBe('guest-1');
      expect(result.items).toHaveLength(1);
      expect(result.subtotal).toBe('1500.00');
    });

    it('should synchronize pricing drift and persist to Redis if catalog price changed', async () => {
      const mockRedisCart: RedisCart = {
        id: 'guest-1',
        status: 'ACTIVE',
        subtotal: '1500.00',
        grandTotal: '1500.00',
        currency: 'INR',
        items: [
          {
            id: 'item-1',
            cartId: 'guest-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 1,
            unitPrice: '1500.00',
            totalPrice: '1500.00',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      cartRedisRepository.getGuestCart.mockResolvedValue(mockRedisCart);
      cartPricingSync.syncAndEnrichItems.mockResolvedValue({
        items: [
          {
            id: 'item-1',
            cartId: 'guest-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 1,
            unitPrice: '1800.00',
            totalPrice: '1800.00',
            currency: 'INR',
            thumbnail: null,
            isAvailable: true,
            availableQuantity: 5,
          },
        ],
        subtotal: '1800.00',
        grandTotal: '1800.00',
        currency: 'INR',
        hasDrift: true,
        driftUpdates: [{ itemId: 'item-1', unitPrice: 1800, totalPrice: 1800 }],
      });

      const result = await service.getCart({ userId: null, guestCartId: 'guest-1' });

      expect(result.subtotal).toBe('1800.00');
      expect(cartRedisRepository.saveGuestCart).toHaveBeenCalledWith(
        'guest-1',
        expect.objectContaining({ subtotal: '1800.00' }),
      );
    });

    it('should return empty cart if authenticated user has no cart in DB', async () => {
      cartRepository.findActiveCartByUserId.mockResolvedValue(null);

      const result = await service.getCart({ userId: 'user-1', guestCartId: null });

      expect(result.id).toBeNull();
      expect(result.items).toHaveLength(0);
    });

    it('should return hydrated authenticated cart and sync price drift to DB', async () => {
      const mockDbCart = {
        id: 'cart-db-1',
        userId: 'user-1',
        subtotal: 1500,
        grandTotal: 1500,
        items: [
          {
            id: 'db-item-1',
            cartId: 'cart-db-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 1,
            unitPrice: 1500,
            totalPrice: 1500,
            metaData: null,
          },
        ],
      };

      cartRepository.findActiveCartByUserId.mockResolvedValue(mockDbCart);
      cartPricingSync.syncAndEnrichItems.mockResolvedValue({
        items: [
          {
            id: 'db-item-1',
            cartId: 'cart-db-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 1,
            unitPrice: '1600.00',
            totalPrice: '1600.00',
            currency: 'INR',
            thumbnail: null,
            isAvailable: true,
            availableQuantity: 3,
          },
        ],
        subtotal: '1600.00',
        grandTotal: '1600.00',
        currency: 'INR',
        hasDrift: true,
        driftUpdates: [{ itemId: 'db-item-1', unitPrice: 1600, totalPrice: 1600 }],
      });

      const result = await service.getCart({ userId: 'user-1', guestCartId: null });

      expect(result.id).toBe('cart-db-1');
      expect(result.subtotal).toBe('1600.00');
      expect(cartRepository.syncPricesBatch).toHaveBeenCalledWith(
        'cart-db-1',
        [{ itemId: 'db-item-1', unitPrice: 1600, totalPrice: 1600 }],
        '1600.00',
        '1600.00',
      );
    });
  });

  describe('addItem', () => {
    it('should throw CartVariantUnavailableException if variant is not found', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(null);

      await expect(
        service.addItem(
          { userId: null, guestCartId: null },
          { variantId: 'var-unknown', quantity: 1 },
        ),
      ).rejects.toThrow(CartVariantUnavailableException);
    });

    it('should throw CartVariantUnavailableException if variant status is not ACTIVE', async () => {
      prisma.productVariant.findUnique.mockResolvedValue({
        ...mockActiveVariant,
        status: VariantStatus.DISCONTINUED,
      });

      await expect(
        service.addItem({ userId: null, guestCartId: null }, { variantId: 'var-1', quantity: 1 }),
      ).rejects.toThrow(CartVariantUnavailableException);
    });

    it('should create new guest cart, set newGuestCartId, and save to Redis on first item add', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(mockActiveVariant);
      cartPricingSync.syncAndEnrichItems.mockResolvedValue({
        items: [
          {
            id: 'item-1',
            cartId: 'new-guest-id',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 2,
            unitPrice: '1500.00',
            totalPrice: '3000.00',
            currency: 'INR',
            thumbnail: null,
            isAvailable: true,
            availableQuantity: 5,
          },
        ],
        subtotal: '3000.00',
        grandTotal: '3000.00',
        currency: 'INR',
        hasDrift: false,
        driftUpdates: [],
      });

      const result = await service.addItem(
        { userId: null, guestCartId: null },
        { variantId: 'var-1', quantity: 2 },
      );

      expect(result.newGuestCartId).toBeDefined();
      expect(cartRedisRepository.saveGuestCart).toHaveBeenCalled();
      expect(result.cart.subtotal).toBe('3000.00');
    });

    it('should increment quantity when existing variant added to guest cart', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(mockActiveVariant);

      const existingRedisCart: RedisCart = {
        id: 'guest-1',
        status: 'ACTIVE',
        subtotal: '1500.00',
        grandTotal: '1500.00',
        currency: 'INR',
        items: [
          {
            id: 'item-1',
            cartId: 'guest-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 1,
            unitPrice: '1500.00',
            totalPrice: '1500.00',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      cartRedisRepository.getGuestCart.mockResolvedValue(existingRedisCart);
      cartPricingSync.syncAndEnrichItems.mockResolvedValue({
        items: [
          {
            id: 'item-1',
            cartId: 'guest-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 3,
            unitPrice: '1500.00',
            totalPrice: '4500.00',
            currency: 'INR',
            thumbnail: null,
            isAvailable: true,
            availableQuantity: 5,
          },
        ],
        subtotal: '4500.00',
        grandTotal: '4500.00',
        currency: 'INR',
        hasDrift: false,
        driftUpdates: [],
      });

      const result = await service.addItem(
        { userId: null, guestCartId: 'guest-1' },
        { variantId: 'var-1', quantity: 2 },
      );

      expect(result.newGuestCartId).toBeUndefined();
      expect(existingRedisCart.items[0].quantity).toBe(3);
      expect(cartRedisRepository.saveGuestCart).toHaveBeenCalled();
    });

    it('should add item to authenticated user cart in PostgreSQL', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(mockActiveVariant);
      cartRepository.findOrCreateCart.mockResolvedValue({
        id: 'auth-cart-1',
        userId: 'user-1',
        items: [],
      });
      cartRepository.findActiveCartByUserId.mockResolvedValue({
        id: 'auth-cart-1',
        userId: 'user-1',
        items: [
          {
            id: 'db-item-1',
            cartId: 'auth-cart-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 1,
            unitPrice: 1500,
            totalPrice: 1500,
            metaData: null,
          },
        ],
      });
      cartPricingSync.syncAndEnrichItems.mockResolvedValue({
        items: [
          {
            id: 'db-item-1',
            cartId: 'auth-cart-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 1,
            unitPrice: '1500.00',
            totalPrice: '1500.00',
            currency: 'INR',
            thumbnail: null,
            isAvailable: true,
            availableQuantity: 5,
          },
        ],
        subtotal: '1500.00',
        grandTotal: '1500.00',
        currency: 'INR',
        hasDrift: false,
        driftUpdates: [],
      });

      const result = await service.addItem(
        { userId: 'user-1', guestCartId: null },
        { variantId: 'var-1', quantity: 1 },
      );

      expect(cartRepository.upsertCartItem).toHaveBeenCalledWith(
        'auth-cart-1',
        expect.objectContaining({
          productId: 'prod-1',
          variantId: 'var-1',
          quantity: 1,
        }),
      );
      expect(result.cart.subtotal).toBe('1500.00');
    });
  });

  describe('updateItemQuantity', () => {
    it('should replace item quantity in guest cart', async () => {
      const mockRedisCart: RedisCart = {
        id: 'guest-1',
        status: 'ACTIVE',
        subtotal: '1500.00',
        grandTotal: '1500.00',
        currency: 'INR',
        items: [
          {
            id: 'item-1',
            cartId: 'guest-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 1,
            unitPrice: '1500.00',
            totalPrice: '1500.00',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      cartRedisRepository.getGuestCart.mockResolvedValue(mockRedisCart);
      prisma.productVariant.findUnique.mockResolvedValue(mockActiveVariant);
      cartPricingSync.syncAndEnrichItems.mockResolvedValue({
        items: [
          {
            id: 'item-1',
            cartId: 'guest-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 4,
            unitPrice: '1500.00',
            totalPrice: '6000.00',
            currency: 'INR',
            thumbnail: null,
            isAvailable: true,
            availableQuantity: 5,
          },
        ],
        subtotal: '6000.00',
        grandTotal: '6000.00',
        currency: 'INR',
        hasDrift: false,
        driftUpdates: [],
      });

      const result = await service.updateItemQuantity(
        { userId: null, guestCartId: 'guest-1' },
        'item-1',
        { quantity: 4 },
      );

      expect(mockRedisCart.items[0].quantity).toBe(4);
      expect(result.subtotal).toBe('6000.00');
    });

    it('should throw CartItemNotFoundException if itemId is not in guest cart', async () => {
      const mockRedisCart: RedisCart = {
        id: 'guest-1',
        status: 'ACTIVE',
        subtotal: '0.00',
        grandTotal: '0.00',
        currency: 'INR',
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      cartRedisRepository.getGuestCart.mockResolvedValue(mockRedisCart);

      await expect(
        service.updateItemQuantity({ userId: null, guestCartId: 'guest-1' }, 'non-existent-item', {
          quantity: 2,
        }),
      ).rejects.toThrow(CartItemNotFoundException);
    });
  });

  describe('removeItem', () => {
    it('should remove item from guest cart and keep cart active', async () => {
      const mockRedisCart: RedisCart = {
        id: 'guest-1',
        status: 'ACTIVE',
        subtotal: '1500.00',
        grandTotal: '1500.00',
        currency: 'INR',
        items: [
          {
            id: 'item-1',
            cartId: 'guest-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 1,
            unitPrice: '1500.00',
            totalPrice: '1500.00',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      cartRedisRepository.getGuestCart.mockResolvedValue(mockRedisCart);
      cartPricingSync.syncAndEnrichItems.mockResolvedValue({
        items: [],
        subtotal: '0.00',
        grandTotal: '0.00',
        currency: 'INR',
        hasDrift: false,
        driftUpdates: [],
      });

      const result = await service.removeItem({ userId: null, guestCartId: 'guest-1' }, 'item-1');

      expect(mockRedisCart.items).toHaveLength(0);
      expect(result.items).toHaveLength(0);
      expect(result.subtotal).toBe('0.00');
    });
  });

  describe('clearCart', () => {
    it('should clear guest cart and indicate shouldClearCookie: true', async () => {
      const result = await service.clearCart({ userId: null, guestCartId: 'guest-1' });

      expect(cartRedisRepository.deleteGuestCart).toHaveBeenCalledWith('guest-1');
      expect(result.shouldClearCookie).toBe(true);
      expect(result.cart.items).toHaveLength(0);
    });

    it('should clear authenticated cart in DB and return shouldClearCookie: false', async () => {
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 'cart-1', userId: 'user-1' });

      const result = await service.clearCart({ userId: 'user-1', guestCartId: null });

      expect(cartRepository.clearCart).toHaveBeenCalledWith('cart-1');
      expect(result.shouldClearCookie).toBe(false);
      expect(result.cart.items).toHaveLength(0);
    });
  });

  describe('mergeCart', () => {
    it('should be a no-op if no guestCartId provided', async () => {
      cartRepository.findActiveCartByUserId.mockResolvedValue(null);

      const result = await service.mergeCart('user-1', null);

      expect(result.id).toBeNull();
      expect(cartRepository.executeInTransaction).not.toHaveBeenCalled();
    });

    it('should merge guest cart items into authenticated user cart in PostgreSQL', async () => {
      const mockGuestCart: RedisCart = {
        id: 'guest-1',
        status: 'ACTIVE',
        subtotal: '3000.00',
        grandTotal: '3000.00',
        currency: 'INR',
        items: [
          {
            id: 'item-guest-1',
            cartId: 'guest-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 2,
            unitPrice: '1500.00',
            totalPrice: '3000.00',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      cartRedisRepository.getGuestCart.mockResolvedValue(mockGuestCart);
      cartRepository.findOrCreateCart.mockResolvedValue({ id: 'auth-cart-1', userId: 'user-1' });
      prisma.productVariant.findMany.mockResolvedValue([mockActiveVariant]);

      cartRepository.executeInTransaction.mockImplementation(
        (txCallback: (tx: unknown) => Promise<unknown>) => {
          const mockTx = {
            cartItem: {
              findMany: jest.fn().mockResolvedValue([]),
              create: jest.fn(),
              update: jest.fn(),
            },
            cart: {
              update: jest.fn(),
            },
          };
          return txCallback(mockTx);
        },
      );

      // After merge, getCart is called
      cartRepository.findActiveCartByUserId.mockResolvedValue({
        id: 'auth-cart-1',
        userId: 'user-1',
        items: [
          {
            id: 'merged-item-1',
            cartId: 'auth-cart-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 2,
            unitPrice: 1500,
            totalPrice: 3000,
            metaData: null,
          },
        ],
      });
      cartPricingSync.syncAndEnrichItems.mockResolvedValue({
        items: [
          {
            id: 'merged-item-1',
            cartId: 'auth-cart-1',
            productId: 'prod-1',
            variantId: 'var-1',
            name: 'Timmbr Chair - SKU-001',
            sku: 'SKU-001',
            quantity: 2,
            unitPrice: '1500.00',
            totalPrice: '3000.00',
            currency: 'INR',
            thumbnail: null,
            isAvailable: true,
            availableQuantity: 5,
          },
        ],
        subtotal: '3000.00',
        grandTotal: '3000.00',
        currency: 'INR',
        hasDrift: false,
        driftUpdates: [],
      });

      const result = await service.mergeCart('user-1', 'guest-1');

      expect(cartRepository.executeInTransaction).toHaveBeenCalled();
      expect(cartRedisRepository.deleteGuestCart).toHaveBeenCalledWith('guest-1');
      expect(result.subtotal).toBe('3000.00');
    });
  });
});
