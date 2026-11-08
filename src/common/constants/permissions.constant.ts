export const STAFF_PERMISSIONS = {
  ORDERS_READ: 'orders:read',
  ORDERS_UPDATE: 'orders:update',
  ORDERS_MESSAGE: 'orders:message',
  ORDERS_CANCEL: 'orders:cancel',
  ORDERS_DELIVER: 'orders:deliver',
} as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[keyof typeof STAFF_PERMISSIONS];

export const ALL_STAFF_PERMISSIONS: StaffPermission[] = Object.values(STAFF_PERMISSIONS);
