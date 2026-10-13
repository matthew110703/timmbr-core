import { BadRequestException } from '@nestjs/common';
import {
  FILTERS_MAX_GROUPS,
  FILTERS_MAX_VALUES_PER_GROUP,
  parseFilters,
  serializeFilters,
} from './listing-filters';

describe('listing filters', () => {
  describe('parseFilters', () => {
    it('parses groups and values', () => {
      expect(parseFilters('material:teak,walnut;size:king')).toEqual(
        new Map([
          ['material', ['teak', 'walnut']],
          ['size', ['king']],
        ]),
      );
    });

    it('is empty for a missing or blank value', () => {
      expect(parseFilters(undefined).size).toBe(0);
      expect(parseFilters('').size).toBe(0);
      expect(parseFilters(';;').size).toBe(0);
    });

    it('merges repeated keys and drops duplicate and empty values', () => {
      expect(parseFilters('material:teak,,teak;material:oak;size:')).toEqual(
        new Map([['material', ['teak', 'oak']]]),
      );
    });

    it.each(['material', ':teak', 'Material:teak', 'material:Teak', 'material:teak wood', 'a:b%'])(
      'rejects malformed input %p',
      (raw) => {
        const error = (() => {
          try {
            return parseFilters(raw);
          } catch (e) {
            return e;
          }
        })();
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          code: 'LISTING_FILTERS_INVALID',
        });
      },
    );

    it('limits groups and values per group', () => {
      const groups = Array.from({ length: FILTERS_MAX_GROUPS + 1 }, (_, i) => `k${i}:v`).join(';');
      expect(() => parseFilters(groups)).toThrow(BadRequestException);

      const values = Array.from({ length: FILTERS_MAX_VALUES_PER_GROUP + 1 }, (_, i) => `v${i}`);
      expect(() => parseFilters(`k:${values.join(',')}`)).toThrow(BadRequestException);
    });
  });

  describe('serializeFilters', () => {
    it('orders keys and values so equivalent selections are identical', () => {
      const a = serializeFilters(parseFilters('size:queen,king;material:walnut,teak'));
      const b = serializeFilters(parseFilters('material:teak,walnut;size:king,queen'));
      expect(a).toBe('material:teak,walnut;size:king,queen');
      expect(b).toBe(a);
    });

    it('drops empty groups', () => {
      expect(serializeFilters(new Map([['material', []]]))).toBe('');
    });
  });
});
