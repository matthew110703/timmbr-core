/** Number of digits in a one-time code. */
export const OTP_LENGTH = 6;
/** How long a one-time code stays valid. */
export const OTP_TTL_S = 10 * 60;
/** Minimum gap between two codes sent to the same identifier. */
export const OTP_COOLDOWN_S = 60;
/** Codes that may be sent to one identifier per rolling hour. */
export const OTP_MAX_SENDS_PER_HOUR = 5;
/** Wrong guesses allowed before the current code is burned. */
export const OTP_MAX_FAILED_ATTEMPTS = 5;

/** Lifetime of the single-use token that authorises setting a password after OTP. */
export const PASSWORD_SETUP_TTL_S = 10 * 60;

/**
 * After a refresh token is rotated, the same old token keeps returning the new
 * pair for this long (concurrent requests on one page load); later reuse fails.
 */
export const REFRESH_GRACE_S = 30;

/** Single-use code handing OAuth tokens from the API to the storefront BFF. */
export const OAUTH_EXCHANGE_CODE_TTL_S = 60;

/** Lifetime of the OAuth `state` nonce cookie (covers the provider consent screen). */
export const OAUTH_STATE_TTL_S = 10 * 60;
export const OAUTH_STATE_COOKIE = 'oauth_state';
/** Hash of the storefront's binding nonce, carried through the provider round-trip. */
export const OAUTH_BIND_COOKIE = 'oauth_bind';
export const OAUTH_BIND_HASH_RE = /^[0-9a-f]{64}$/;

/** Password-reset link lifetime (admin console flow). */
export const PASSWORD_RESET_TTL_S = 15 * 60;

export type OtpIntent = 'login' | 'reset';
