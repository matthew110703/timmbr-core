export enum Application {
  STOREFRONT = 'STOREFRONT',
  ADMIN_CONSOLE = 'ADMIN_CONSOLE',
}

export type ApplicationType = keyof typeof Application;
