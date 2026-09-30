export function roundToTwoDecimals(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function formatAmount(amount: number | string): string {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numeric)) return '0.00';
  return roundToTwoDecimals(numeric).toFixed(2);
}

export function calculateCartTotals(items: { totalPrice: number | string }[]): {
  subtotal: string;
  grandTotal: string;
} {
  const sum = items.reduce((acc, item) => {
    const price =
      typeof item.totalPrice === 'string' ? parseFloat(item.totalPrice) : item.totalPrice;
    return acc + (isNaN(price) ? 0 : price);
  }, 0);

  const formatted = formatAmount(sum);
  return {
    subtotal: formatted,
    grandTotal: formatted,
  };
}
