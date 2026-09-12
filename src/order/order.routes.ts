export const ORDER_ROUTES = {
  ORDERS: 'orders',
  CHECKOUT: 'checkout',
  QUOTE: 'quote',
  PAYMENT: ':orderId/payment',
  ADMIN_ORDERS: 'admin/orders',
  STATUS: ':orderId/status',
} as const;
