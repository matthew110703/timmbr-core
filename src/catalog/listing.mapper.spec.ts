import { FilterDisplay } from '@prisma/client';
import { ListingMapper } from './listing.mapper';
import {
  AggregateRow,
  FacetCatalog,
  ListingCriteria,
  MAX_FACET_OPTIONS,
} from './listing/listing.types';

const option = (code: number, slug: string) => ({
  id: `o-${code}`,
  code,
  slug,
  label: slug,
  swatchHex: null,
});

function catalogWith(options: ReturnType<typeof option>[]): FacetCatalog {
  const material = {
    id: 'd-material',
    key: 'material',
    label: 'Material',
    displayType: FilterDisplay.CHECKBOX,
    options,
    optionsBySlug: new Map(options.map((o) => [o.slug, o])),
  };
  const brands = [{ id: 'b-1', slug: 'oakline', name: 'Oakline' }];
  return {
    definitions: [material],
    definitionsByKey: new Map([['material', material]]),
    brands,
    brandsBySlug: new Map(brands.map((b) => [b.slug, b])),
  };
}

const criteria = (groups: ListingCriteria['groups'] = []): ListingCriteria => ({
  categoryId: null,
  q: null,
  priceMin: null,
  priceMax: null,
  groups,
  sort: 'relevance',
  page: 1,
  limit: 24,
});

const row = (r: Partial<AggregateRow>): AggregateRow => ({
  kind: 'opt',
  grp: null,
  id: null,
  n: null,
  minp: null,
  maxp: null,
  ...r,
});

describe('ListingMapper', () => {
  const catalog = catalogWith([option(1, 'teak'), option(2, 'oak'), option(3, 'ash')]);

  it('uses unscoped counts for groups with nothing selected and keeps zero-count options', () => {
    const facets = ListingMapper.facets(
      [row({ id: '1', n: 4 }), row({ kind: 'brand', id: 'b-1', n: 4 })],
      catalog,
      criteria(),
    );
    expect(facets[0].options).toEqual([
      { value: 'teak', label: 'teak', swatchHex: null, count: 4, selected: false },
      { value: 'oak', label: 'oak', swatchHex: null, count: 0, selected: false },
      { value: 'ash', label: 'ash', swatchHex: null, count: 0, selected: false },
    ]);
    expect(facets[1]).toMatchObject({ key: 'brand', options: [{ value: 'oakline', count: 4 }] });
  });

  it('uses the scoped counts for a selected group', () => {
    const facets = ListingMapper.facets(
      [
        row({ id: '1', n: 2 }),
        row({ grp: 'material', id: '1', n: 2 }),
        row({ grp: 'material', id: '2', n: 7 }),
      ],
      catalog,
      criteria([{ key: 'material', kind: 'option', codes: [1] }]),
    );
    expect(facets[0].options.map((o) => [o.value, o.count, o.selected])).toEqual([
      ['teak', 2, true],
      ['oak', 7, false],
      ['ash', 0, false],
    ]);
  });

  it('hides a group with no matches and no selection', () => {
    expect(ListingMapper.facets([], catalog, criteria())).toEqual([]);
  });

  it('caps large groups to the top options plus selected ones', () => {
    const many = Array.from({ length: MAX_FACET_OPTIONS + 10 }, (_, i) => option(i, `v${i}`));
    const rows = many.map((o, i) => row({ grp: 'material', id: String(o.code), n: i + 1 }));
    const [facet] = ListingMapper.facets(
      rows,
      catalogWith(many),
      criteria([{ key: 'material', kind: 'option', codes: [0] }]),
    );
    // o0 has the lowest count but is selected, so it stays.
    expect(facet.truncated).toBe(true);
    expect(facet.options).toHaveLength(MAX_FACET_OPTIONS + 1);
    expect(facet.options[0]).toMatchObject({ value: 'v0', selected: true });
  });

  it('builds nice price bounds and clamps the selection', () => {
    const price = ListingMapper.price([row({ kind: 'price', minp: '7999.00', maxp: '99989.00' })], {
      ...criteria(),
      priceMin: 1000,
      priceMax: 50000,
    });
    expect(price).toEqual({
      min: 6000,
      max: 100000,
      step: 2000,
      selectedMin: 6000,
      selectedMax: 50000,
    });
  });

  it('returns an empty price range when nothing matches', () => {
    expect(ListingMapper.price([row({ kind: 'price' })], criteria())).toEqual({
      min: 0,
      max: 0,
      step: 0,
    });
  });
});
