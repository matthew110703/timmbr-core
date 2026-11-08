export const ORDER_NOTIFICATION_QUEUE = 'order-notification';
export const SEND_ORDER_NOTIFICATION_JOB = 'send-order-notification';

export interface OrderNotificationJobPayload {
  orderId: string;
  deliveryId: string;
}

export function buildOrderNotificationJobId(deliveryId: string): string {
  return `order-notification-${deliveryId}`;
}
