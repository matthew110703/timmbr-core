export type Identifier = { type: 'email'; value: string } | { type: 'phone'; value: string };

const EMAIL_RE = /^[^\s@:]+@[^\s@:]+\.[^\s@:]+$/;
const E164_RE = /^\+[1-9]\d{9,14}$/;
const MAX_EMAIL_LENGTH = 254;

/** Default country code for national-format numbers (India). */
const DEFAULT_COUNTRY_CODE = '91';

/**
 * Normalise a user-typed phone number to E.164 so every spelling of the same
 * number maps to one user and one set of OTP keys:
 *   "98765 43210", "09876543210", "919876543210", "+91-98765-43210" → "+919876543210"
 */
export function normalizePhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s\-().]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;

  let e164: string;
  if (compact.startsWith('+')) {
    e164 = compact;
  } else if (compact.length === 10) {
    e164 = `+${DEFAULT_COUNTRY_CODE}${compact}`;
  } else if (compact.length === 11 && compact.startsWith('0')) {
    e164 = `+${DEFAULT_COUNTRY_CODE}${compact.slice(1)}`;
  } else if (compact.length === 12 && compact.startsWith(DEFAULT_COUNTRY_CODE)) {
    e164 = `+${compact}`;
  } else {
    return null;
  }

  return E164_RE.test(e164) ? e164 : null;
}

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(email) ? email : null;
}

/** Classify and normalise an email-or-phone identifier; null when it's neither. */
export function normalizeIdentifier(raw: string): Identifier | null {
  if (raw.includes('@')) {
    const email = normalizeEmail(raw);
    return email ? { type: 'email', value: email } : null;
  }
  const phone = normalizePhone(raw);
  return phone ? { type: 'phone', value: phone } : null;
}

/**
 * Stored formats that may predate E.164 normalisation, so existing phone users
 * are still found: "+919876543210", "919876543210", "9876543210".
 */
export function legacyPhoneVariants(e164: string): string[] {
  const digits = e164.slice(1);
  const variants = [e164, digits];
  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    variants.push(digits.slice(DEFAULT_COUNTRY_CODE.length));
  }
  return variants;
}

/** Mask an identifier for display, e.g. "d*****s@gmail.com", "+91*******210". */
export function maskIdentifier(id: Identifier): string {
  if (id.type === 'phone') {
    return `${id.value.slice(0, 3)}${'*'.repeat(Math.max(1, id.value.length - 6))}${id.value.slice(-3)}`;
  }
  const [user, domain] = id.value.split('@');
  const masked =
    user.length <= 2 ? `${user[0]}*` : `${user[0]}${'*'.repeat(user.length - 2)}${user.slice(-1)}`;
  return `${masked}@${domain}`;
}
