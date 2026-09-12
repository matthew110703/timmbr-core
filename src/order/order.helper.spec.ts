import { OrderStatus } from '@prisma/client';
import {
  ALLOWED_ORDER_TRANSITIONS,
  aggregateVariantStockDecrements,
  calculateOrderExpiration,
  convertRupeesToPaise,
  isOrderTransitionAllowed,
  roundToTwoDecimals,
  validateOrderTransition,
} from './order.helper';
import { OrderIllegalStateTransitionException } from '@/common/exceptions/order.exception';

describe('OrderHelper', () => {
  describe('isOrderTransitionAllowed & validateOrderTransition', () => {
    it('allows valid transitions', () => {
      expect(isOrderTransitionAllowed(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(true);
      expect(isOrderTransitionAllowed(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
      expect(isOrderTransitionAllowed(OrderStatus.CONFIRMED, OrderStatus.PROCESSING)).toBe(true);
      expect(isOrderTransitionAllowed(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(true);
      expect(isOrderTransitionAllowed(OrderStatus.PROCESSING, OrderStatus.SHIPPED)).toBe(true);
      expect(isOrderTransitionAllowed(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
      expect(isOrderTransitionAllowed(OrderStatus.DELIVERED, OrderStatus.RETURNED)).toBe(true);

      expect(() =>
        validateOrderTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED),
      ).not.toThrow();
    });

    it('rejects invalid transitions', () => {
      expect(isOrderTransitionAllowed(OrderStatus.DELIVERED, OrderStatus.PENDING)).toBe(false);
      expect(isOrderTransitionAllowed(OrderStatus.CANCELLED, OrderStatus.CONFIRMED)).toBe(false);
      expect(isOrderTransitionAllowed(OrderStatus.RETURNED, OrderStatus.DELIVERED)).toBe(false);

      expect(() => validateOrderTransition(OrderStatus.DELIVERED, OrderStatus.PENDING)).toThrow(
        OrderIllegalStateTransitionException,
      );
    });

    it('exposes defined state transitions map', () => {
      expect(ALLOWED_ORDER_TRANSITIONS[OrderStatus.PENDING]).toContain(OrderStatus.CONFIRMED);
    });
  });

  describe('calculateOrderExpiration', () => {
    it('returns a future date based on ttl in minutes', () => {
      const before = Date.now();
      const expiresAt = calculateOrderExpiration(15);
      const after = Date.now();

      const expectedDiffMin = 15 * 60 * 1000;
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedDiffMin);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + expectedDiffMin);
    });
  });

  describe('convertRupeesToPaise', () => {
    it('converts correctly and rounds to integer paise', () => {
      expect(convertRupeesToPaise(100)).toBe(10000);
      expect(convertRupeesToPaise(49.99)).toBe(4999);
      expect(convertRupeesToPaise(0.004)).toBe(0);
      expect(convertRupeesToPaise(0.005)).toBe(1);
    });
  });

  describe('roundToTwoDecimals', () => {
    it('rounds float precision to two decimal places', () => {
      expect(roundToTwoDecimals(10.1234)).toBe(10.12);
      expect(roundToTwoDecimals(10.126)).toBe(10.13);
      expect(roundToTwoDecimals(10)).toBe(10);
    });
  });

  describe('aggregateVariantStockDecrements', () => {
    it('aggregates quantities per variant across orders', () => {
      const orders = [
        {
          items: [
            { variantId: 'v1', quantity: 2 },
            { variantId: 'v2', quantity: 1 },
            { variantId: null, quantity: 3 },
          ],
        },
        {
          items: [
            { variantId: 'v1', quantity: 3 },
            { variantId: 'v3', quantity: 5 },
          ],
        },
      ];

      const result = aggregateVariantStockDecrements(orders);
      expect(result.get('v1')).toBe(5);
      expect(result.get('v2')).toBe(1);
      expect(result.get('v3')).toBe(5);
      expect(result.has('null')).toBe(false);
    });

    it('returns empty map for empty orders list', () => {
      const result = aggregateVariantStockDecrements([]);
      expect(result.size).toBe(0);
    });
  });
});
