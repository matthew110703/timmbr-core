import { searchTerms, toSearchQuery } from './search-terms';

describe('toSearchQuery', () => {
  it('lowercases and collapses whitespace', () => {
    expect(toSearchQuery('  Teak   BED ')).toBe('teak bed');
  });

  it('drops 1-letter words and duplicates, keeping the typed order', () => {
    expect(toSearchQuery('a teak bed Teak x')).toBe('teak bed');
  });

  it('keeps at most 6 words', () => {
    expect(toSearchQuery('aa bb cc dd ee ff gg hh')).toBe('aa bb cc dd ee ff');
  });

  it('is null when nothing usable is left', () => {
    expect(toSearchQuery(undefined)).toBeNull();
    expect(toSearchQuery('')).toBeNull();
    expect(toSearchQuery('a b c')).toBeNull();
  });

  it('keeps punctuation inside words (escaped later in SQL)', () => {
    expect(toSearchQuery("O'Neil 50%")).toBe("o'neil 50%");
  });
});

describe('searchTerms', () => {
  it('splits a normalised query into words', () => {
    expect(searchTerms('teak bed')).toEqual(['teak', 'bed']);
  });
});
