import { FilterDisplay } from '@prisma/client';
import {
  ListingFacetDto,
  ListingFacetOptionDto,
  ListingPriceDto,
  ListingProductDto,
} from './dto/listing-response.dto';
import {
  AggregateRow,
  BRAND_FILTER_KEY,
  FacetCatalog,
  ListingCriteria,
  ListingRow,
  MAX_FACET_OPTIONS,
} from './listing/listing.types';
import { clampToRange, niceRange } from './listing/price-range';

const toNumber = (value: unknown): number => Number(value);

export class ListingMapper {
  static toProduct(row: ListingRow, imageUrl: (key: string) => string): ListingProductDto {
    return {
      id: row.productId,
      slug: row.slug,
      title: row.title,
      brandName: row.brandName ?? null,
      price: toNumber(row.price),
      compareAtPrice: row.compareAtPrice === null ? null : toNumber(row.compareAtPrice),
      currency: row.currency,
      discountPct: row.discountPct,
      hasMultipleVariants: row.hasMultipleVariants,
      inStock: row.inStock,
      defaultVariantId: row.defaultVariantId ?? null,
      coverImage: row.coverImageKey
        ? { url: imageUrl(row.coverImageKey), alt: row.coverAlt ?? null }
        : null,
    };
  }

  static total(rows: AggregateRow[]): number {
    return rows.find((row) => row.kind === 'total')?.n ?? 0;
  }

  /** Nice slider bounds from the price range of the matches (ignoring the price filter). */
  static price(rows: AggregateRow[], criteria: ListingCriteria): ListingPriceDto {
    const row = rows.find((r) => r.kind === 'price');
    if (!row || row.minp === null || row.maxp === null) {
      return { min: 0, max: 0, step: 0 };
    }
    const range = niceRange(toNumber(row.minp), toNumber(row.maxp));
    const selectedMin = clampToRange(criteria.priceMin, range);
    const selectedMax = clampToRange(criteria.priceMax, range);
    return {
      ...range,
      ...(selectedMin !== undefined && { selectedMin }),
      ...(selectedMax !== undefined && { selectedMax }),
    };
  }

  /**
   * Facet groups in panel order. A selected group's counts ignore its own selection; the others
   * use counts under every filter. A group shows when any option matches or is selected, and
   * zero-count options stay in (the panel greys them out). Brand comes last.
   */
  static facets(
    rows: AggregateRow[],
    catalog: FacetCatalog,
    criteria: ListingCriteria,
  ): ListingFacetDto[] {
    const unscoped = new Map<string, number>();
    const scoped = new Map<string, Map<string, number>>();
    const brandsUnscoped = new Map<string, number>();
    const brandsScoped = new Map<string, number>();
    for (const row of rows) {
      if (!row.id || row.n === null) continue;
      if (row.kind === 'brand') {
        (row.grp === null ? brandsUnscoped : brandsScoped).set(row.id, row.n);
      } else if (row.kind === 'opt') {
        if (row.grp === null) {
          unscoped.set(row.id, row.n);
        } else {
          const counts = scoped.get(row.grp) ?? new Map<string, number>();
          counts.set(row.id, row.n);
          scoped.set(row.grp, counts);
        }
      }
    }
    // Selected values as the aggregate reports them: option codes (as text) or brand ids.
    const selectedIds = new Map(
      criteria.groups.map((g) => [
        g.key,
        new Set(g.kind === 'option' ? g.codes.map(String) : g.ids),
      ]),
    );

    const facets: ListingFacetDto[] = [];
    for (const definition of catalog.definitions) {
      const selected = selectedIds.get(definition.key);
      const counts = selected
        ? (scoped.get(definition.key) ?? new Map<string, number>())
        : unscoped;
      const options = definition.options.map((option) => ({
        value: option.slug,
        label: option.label,
        swatchHex: option.swatchHex,
        count: counts.get(String(option.code)) ?? 0,
        selected: selected?.has(String(option.code)) ?? false,
      }));
      if (!options.some((option) => option.count > 0 || option.selected)) continue;
      facets.push({
        key: definition.key,
        label: definition.label,
        displayType: definition.displayType,
        ...ListingMapper.cap(options),
      });
    }

    const selectedBrands = selectedIds.get(BRAND_FILTER_KEY);
    const brandCounts = selectedBrands ? brandsScoped : brandsUnscoped;
    const brandOptions = catalog.brands
      .map((brand) => ({
        value: brand.slug,
        label: brand.name,
        count: brandCounts.get(brand.id) ?? 0,
        selected: selectedBrands?.has(brand.id) ?? false,
      }))
      .filter((option) => option.count > 0 || option.selected);
    if (brandOptions.length > 0) {
      facets.push({
        key: BRAND_FILTER_KEY,
        label: 'Brand',
        displayType: FilterDisplay.CHECKBOX,
        ...ListingMapper.cap(brandOptions),
      });
    }
    return facets;
  }

  /** Keeps the top options by count plus every selected one, in their original order. */
  private static cap(options: ListingFacetOptionDto[]): {
    options: ListingFacetOptionDto[];
    truncated: boolean;
  } {
    if (options.length <= MAX_FACET_OPTIONS) return { options, truncated: false };
    const keep = new Set(
      [...options]
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_FACET_OPTIONS)
        .map((option) => option.value),
    );
    return {
      options: options.filter((option) => option.selected || keep.has(option.value)),
      truncated: true,
    };
  }
}
