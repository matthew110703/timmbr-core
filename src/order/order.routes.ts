export const ORDER_ROUTES = {
  ORDERS: 'orders',
  CHECKOUT: 'checkout',
  QUOTE: 'quote',
  PAYMENT: ':orderId/payment',
  PAYMENT_SESSION: ':orderId/payment-session',
  ADMIN_ORDERS: 'admin/orders',
  STATUS: ':orderId/status',
} as const;
