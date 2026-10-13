/** Slider steps in rupees, smallest first. */
export const PRICE_STEPS = [500, 1000, 2000, 5000, 10000] as const;
/** At most this many slider stops between the bounds. */
export const MAX_PRICE_STOPS = 50;

export interface PriceRange {
  min: number;
  max: number;
  step: number;
}

/**
 * "Nice" slider bounds for prices between `min` and `max`: the smallest step from PRICE_STEPS
 * that keeps the slider within MAX_PRICE_STOPS stops, with both bounds snapped outward to it.
 * Wider ranges use a multiple of the largest step. The range always spans at least one step.
 */
export function niceRange(min: number, max: number): PriceRange {
  const low = Math.max(0, Math.floor(Math.min(min, max)));
  const high = Math.max(low, Math.ceil(Math.max(min, max)));

  const snap = (step: number): PriceRange => {
    const lo = Math.floor(low / step) * step;
    const hi = Math.max(lo + step, Math.ceil(high / step) * step);
    return { min: lo, max: hi, step };
  };

  for (const step of PRICE_STEPS) {
    const range = snap(step);
    if ((range.max - range.min) / step <= MAX_PRICE_STOPS) return range;
  }
  const largest = PRICE_STEPS[PRICE_STEPS.length - 1];
  return snap(largest * Math.ceil((high - low) / (largest * MAX_PRICE_STOPS)));
}

/** A selected bound clamped into the range (undefined when not selected). */
export function clampToRange(value: number | null, range: PriceRange): number | undefined {
  if (value === null) return undefined;
  return Math.min(range.max, Math.max(range.min, value));
}
