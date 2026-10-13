import { SetMetadata } from '@nestjs/common';

export const TRUSTED_UNTHROTTLED_KEY = 'trustedUnthrottled';

/**
 * Public, cacheable reads that the storefront servers call on behalf of many shoppers. Requests
 * from a trusted client (valid `x-internal-key`) skip rate limiting here: otherwise every shopper
 * would share the storefront server's single bucket. Anyone else keeps the normal limit.
 */
export const TrustedUnthrottled = () => SetMetadata(TRUSTED_UNTHROTTLED_KEY, true);
