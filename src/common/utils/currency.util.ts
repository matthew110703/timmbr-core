const supportedCurrencies = new Set(Intl.supportedValuesOf('currency'));

export function isValidCurrencyCode(code: string): boolean {
  if (typeof code !== 'string') {
    return false;
  }

  return supportedCurrencies.has(code.trim().toUpperCase());
}

export function getAllSupportedCurrencies(): string[] {
  return [...supportedCurrencies];
}
