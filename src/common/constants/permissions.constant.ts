export const PERMISSIONS = {
  // Users (Customers & Staff)
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',

  // Admins (Assignable exclusively by Master)
  ADMINS_CREATE: 'admins:create',
  ADMINS_UPDATE: 'admins:update',

  // Orders
  ORDERS_READ: 'orders:read',
  ORDERS_UPDATE: 'orders:update',
  ORDERS_CANCEL: 'orders:cancel',
  ORDERS_MESSAGE: 'orders:message',
  ORDERS_DELIVER: 'orders:deliver',

  // Catalog (Products, Categories, Brands, Attributes)
  CATALOG_READ: 'catalog:read',
  CATALOG_WRITE: 'catalog:write',
  CATALOG_DELETE: 'catalog:delete',

  // Transactions
  TRANSACTIONS_READ: 'transactions:read',
  TRANSACTIONS_REFUND: 'transactions:refund',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Permissions assignable exclusively by MASTER */
export const MASTER_ONLY_PERMISSIONS: Permission[] = [
  PERMISSIONS.ADMINS_CREATE,
  PERMISSIONS.ADMINS_UPDATE,
];

/** Operational permissions permitted for STAFF accounts */
export const STAFF_ASSIGNABLE_PERMISSIONS: Permission[] = [
  PERMISSIONS.ORDERS_READ,
  PERMISSIONS.ORDERS_UPDATE,
  PERMISSIONS.ORDERS_CANCEL,
  PERMISSIONS.ORDERS_MESSAGE,
  PERMISSIONS.ORDERS_DELIVER,
  PERMISSIONS.CATALOG_READ,
  PERMISSIONS.CATALOG_WRITE,
  PERMISSIONS.TRANSACTIONS_READ,
];

/** Permissions permitted for ADMIN accounts */
export const ADMIN_ASSIGNABLE_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Prerequisite permissions required before a dependent permission may be held. */
export const PERMISSION_DEPENDENCIES: Partial<Record<Permission, readonly Permission[]>> = {
  [PERMISSIONS.USERS_CREATE]: [PERMISSIONS.USERS_READ],
  [PERMISSIONS.USERS_UPDATE]: [PERMISSIONS.USERS_READ],
  [PERMISSIONS.ADMINS_CREATE]: [PERMISSIONS.USERS_READ],
  [PERMISSIONS.ADMINS_UPDATE]: [PERMISSIONS.USERS_READ],
  [PERMISSIONS.ORDERS_UPDATE]: [PERMISSIONS.ORDERS_READ],
  [PERMISSIONS.ORDERS_CANCEL]: [PERMISSIONS.ORDERS_READ],
  [PERMISSIONS.ORDERS_MESSAGE]: [PERMISSIONS.ORDERS_READ],
  [PERMISSIONS.ORDERS_DELIVER]: [PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_UPDATE],
  [PERMISSIONS.CATALOG_WRITE]: [PERMISSIONS.CATALOG_READ],
  [PERMISSIONS.CATALOG_DELETE]: [PERMISSIONS.CATALOG_READ],
  [PERMISSIONS.TRANSACTIONS_REFUND]: [PERMISSIONS.TRANSACTIONS_READ],
};

export function findMissingPermissionDependencies(
  permissions: readonly Permission[],
): Array<{ permission: Permission; missing: Permission[] }> {
  const granted = new Set<Permission>(permissions);
  const violations: Array<{ permission: Permission; missing: Permission[] }> = [];

  for (const permission of permissions) {
    const required = PERMISSION_DEPENDENCIES[permission];
    if (!required) continue;
    const missing = required.filter((dep) => !granted.has(dep));
    if (missing.length > 0) {
      violations.push({ permission, missing });
    }
  }

  return violations;
}

/** Backward-compatibility aliases for legacy code */
export const STAFF_PERMISSIONS = {
  ORDERS_READ: PERMISSIONS.ORDERS_READ,
  ORDERS_UPDATE: PERMISSIONS.ORDERS_UPDATE,
  ORDERS_MESSAGE: PERMISSIONS.ORDERS_MESSAGE,
  ORDERS_CANCEL: PERMISSIONS.ORDERS_CANCEL,
  ORDERS_DELIVER: PERMISSIONS.ORDERS_DELIVER,
} as const;

export type StaffPermission = Permission;
export const ALL_STAFF_PERMISSIONS: StaffPermission[] = STAFF_ASSIGNABLE_PERMISSIONS;
