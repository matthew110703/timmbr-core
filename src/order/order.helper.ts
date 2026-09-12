import { OrderStatus } from '@prisma/client';
import { OrderIllegalStateTransitionException } from '@/common/exceptions/order.exception';

/**
 * Map of permitted order status transitions.
 * Terminal states (CANCELLED, RETURNED) have no outgoing transitions.
 */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURNED]: [],
} as const;

/**
 * Checks if a transition from currentStatus to newStatus is permissible.
 */
export function isOrderTransitionAllowed(
  currentStatus: OrderStatus,
  newStatus: OrderStatus,
): boolean {
  const allowed = ALLOWED_ORDER_TRANSITIONS[currentStatus] ?? [];
  return allowed.includes(newStatus);
}

/**
 * Validates an order status transition, throwing an exception if illegal.
 */
export function validateOrderTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
  if (!isOrderTransitionAllowed(currentStatus, newStatus)) {
    throw new OrderIllegalStateTransitionException(currentStatus, newStatus);
  }
}

/**
 * Calculates order expiration timestamp based on a TTL in minutes.
 */
export function calculateOrderExpiration(ttlMinutes: number): Date {
  return new Date(Date.now() + ttlMinutes * 60 * 1000);
}

/**
 * Converts a currency amount in rupees to paise (rounded to the nearest integer).
 */
export function convertRupeesToPaise(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Rounds a floating-point currency or financial amount to 2 decimal places.
 */
export function roundToTwoDecimals(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export interface OrderItemWithVariantQuantity {
  variantId?: string | null;
  quantity: number;
}

export interface OrderWithVariantItems {
  items: OrderItemWithVariantQuantity[];
}

/**
 * Aggregates variant stock decrements across multiple orders.
 * Used during cleanup of expired pending orders to batch-release reserved stock.
 */
export function aggregateVariantStockDecrements(
  orders: OrderWithVariantItems[],
): Map<string, number> {
  const variantDecrements = new Map<string, number>();

  for (const order of orders) {
    for (const item of order.items) {
      if (item.variantId) {
        const current = variantDecrements.get(item.variantId) ?? 0;
        variantDecrements.set(item.variantId, current + item.quantity);
      }
    }
  }

  return variantDecrements;
}
