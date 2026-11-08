export enum Application {
  STOREFRONT = 'STOREFRONT',
  ADMIN_CONSOLE = 'ADMIN_CONSOLE',
  STAFF_COMPANION = 'STAFF_COMPANION',
}

export type ApplicationType = keyof typeof Application;
