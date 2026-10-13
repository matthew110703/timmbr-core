import { clampToRange, MAX_PRICE_STOPS, niceRange } from './price-range';

describe('niceRange', () => {
  it('uses the smallest step that keeps the slider within the stop limit', () => {
    expect(niceRange(4999, 19999)).toEqual({ min: 4500, max: 20000, step: 500 });
    expect(niceRange(7999, 99989)).toEqual({ min: 6000, max: 100000, step: 2000 });
    expect(niceRange(4999, 149999)).toEqual({ min: 0, max: 150000, step: 5000 });
    expect(niceRange(10000, 450000)).toEqual({ min: 10000, max: 450000, step: 10000 });
  });

  it('scales past the largest step for very wide ranges', () => {
    const range = niceRange(0, 5_000_000);
    expect(range.step).toBe(100000);
    expect((range.max - range.min) / range.step).toBeLessThanOrEqual(MAX_PRICE_STOPS);
  });

  it('always spans at least one step', () => {
    expect(niceRange(32999, 32999)).toEqual({ min: 32500, max: 33000, step: 500 });
    expect(niceRange(0, 0)).toEqual({ min: 0, max: 500, step: 500 });
  });

  it('handles swapped or negative input', () => {
    expect(niceRange(20000, 5000)).toEqual(niceRange(5000, 20000));
    expect(niceRange(-50, 900).min).toBe(0);
  });
});

describe('clampToRange', () => {
  const range = { min: 5000, max: 50000, step: 1000 };

  it('clamps a selected bound into the range', () => {
    expect(clampToRange(1000, range)).toBe(5000);
    expect(clampToRange(90000, range)).toBe(50000);
    expect(clampToRange(12000, range)).toBe(12000);
  });

  it('is undefined when nothing is selected', () => {
    expect(clampToRange(null, range)).toBeUndefined();
  });
});
