import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CART_CONSTANTS } from './cart.constants';
import type { FastifyReply, FastifyRequest } from 'fastify';

describe('CartController', () => {
  let controller: CartController;
  let cartService: jest.Mocked<any>;

  const mockCartResponse = {
    id: 'cart-1',
    items: [],
    subtotal: '0.00',
    grandTotal: '0.00',
    currency: 'INR',
  };

  beforeEach(async () => {
    cartService = {
      getCart: jest.fn().mockResolvedValue(mockCartResponse),
      addItem: jest.fn().mockResolvedValue({ cart: mockCartResponse }),
      updateItemQuantity: jest.fn().mockResolvedValue(mockCartResponse),
      removeItem: jest.fn().mockResolvedValue(mockCartResponse),
      clearCart: jest.fn().mockResolvedValue({ cart: mockCartResponse, shouldClearCookie: false }),
      mergeCart: jest.fn().mockResolvedValue(mockCartResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: cartService }],
    }).compile();

    controller = module.get<CartController>(CartController);
  });

  function createMockRequest(userId?: string, guestCartId?: string): FastifyRequest {
    return {
      user: userId ? { sub: userId } : undefined,
      cookies: guestCartId ? { [CART_CONSTANTS.GUEST_CART_COOKIE]: guestCartId } : {},
    } as unknown as FastifyRequest;
  }

  function createMockReply(): FastifyReply {
    return {
      setCookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as FastifyReply;
  }

  describe('getCart', () => {
    it('should call cartService.getCart with resolved context', async () => {
      const req = createMockRequest('user-1', 'guest-1');
      const result = await controller.getCart(req);

      expect(cartService.getCart).toHaveBeenCalledWith({
        userId: 'user-1',
        guestCartId: 'guest-1',
      });
      expect(result).toEqual(mockCartResponse);
    });
  });

  describe('addItem', () => {
    it('should add item and set cookie when newGuestCartId is generated', async () => {
      cartService.addItem.mockResolvedValue({
        cart: mockCartResponse,
        newGuestCartId: 'new-guest-123',
      });

      const req = createMockRequest(undefined, undefined);
      const reply = createMockReply();
      const dto = { variantId: 'var-1', quantity: 2 };

      const result = await controller.addItem(req, reply, dto);

      expect(cartService.addItem).toHaveBeenCalledWith({ userId: null, guestCartId: null }, dto);
      expect(reply.setCookie).toHaveBeenCalledWith(
        CART_CONSTANTS.GUEST_CART_COOKIE,
        'new-guest-123',
        expect.any(Object),
      );
      expect(result).toEqual(mockCartResponse);
    });

    it('should not set cookie if no newGuestCartId returned (e.g. auth user)', async () => {
      cartService.addItem.mockResolvedValue({
        cart: mockCartResponse,
      });

      const req = createMockRequest('user-1', undefined);
      const reply = createMockReply();
      const dto = { variantId: 'var-1', quantity: 1 };

      await controller.addItem(req, reply, dto);

      expect(reply.setCookie).not.toHaveBeenCalled();
    });
  });

  describe('updateItemQuantity', () => {
    it('should update item quantity', async () => {
      const req = createMockRequest('user-1', undefined);
      const dto = { quantity: 3 };

      const result = await controller.updateItemQuantity(req, 'item-1', dto);

      expect(cartService.updateItemQuantity).toHaveBeenCalledWith(
        { userId: 'user-1', guestCartId: null },
        'item-1',
        dto,
      );
      expect(result).toEqual(mockCartResponse);
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      const req = createMockRequest('user-1', undefined);

      const result = await controller.removeItem(req, 'item-1');

      expect(cartService.removeItem).toHaveBeenCalledWith(
        { userId: 'user-1', guestCartId: null },
        'item-1',
      );
      expect(result).toEqual(mockCartResponse);
    });
  });

  describe('clearCart', () => {
    it('should clear cart and clear cookie if guest', async () => {
      cartService.clearCart.mockResolvedValue({
        cart: mockCartResponse,
        shouldClearCookie: true,
      });

      const req = createMockRequest(undefined, 'guest-1');
      const reply = createMockReply();

      const result = await controller.clearCart(req, reply);

      expect(cartService.clearCart).toHaveBeenCalledWith({
        userId: null,
        guestCartId: 'guest-1',
      });
      expect(reply.clearCookie).toHaveBeenCalledWith(CART_CONSTANTS.GUEST_CART_COOKIE, {
        path: '/',
      });
      expect(result).toEqual(mockCartResponse);
    });

    it('should clear cart and not clear cookie if auth user', async () => {
      cartService.clearCart.mockResolvedValue({
        cart: mockCartResponse,
        shouldClearCookie: false,
      });

      const req = createMockRequest('user-1', undefined);
      const reply = createMockReply();

      await controller.clearCart(req, reply);

      expect(reply.clearCookie).not.toHaveBeenCalled();
    });
  });

  describe('mergeCart', () => {
    it('should merge guest cart into auth user cart and clear guest cookie', async () => {
      const req = createMockRequest('user-1', 'guest-1');
      const reply = createMockReply();

      const result = await controller.mergeCart(req, reply);

      expect(cartService.mergeCart).toHaveBeenCalledWith('user-1', 'guest-1');
      expect(reply.clearCookie).toHaveBeenCalledWith(CART_CONSTANTS.GUEST_CART_COOKIE, {
        path: '/',
      });
      expect(result).toEqual(mockCartResponse);
    });
  });
});
