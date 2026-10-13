import { Injectable } from '@nestjs/common';
import { ListingRepository } from './listing.repository';
import { FacetCatalog, FacetDefinition } from './listing/listing.types';

/** The vocabulary changes rarely (console edits); a minute of staleness is fine. */
const FACET_CATALOG_TTL_MS = 60_000;

/**
 * Filterable attributes, their options and the active brands, cached in-process. Listing
 * queries return option codes; this maps them to keys, slugs and labels without a per-request join.
 */
@Injectable()
export class FacetCatalogService {
  private cached: { catalog: FacetCatalog; expiresAt: number } | null = null;
  private loading: Promise<FacetCatalog> | null = null;

  constructor(private readonly repository: ListingRepository) {}

  async get(): Promise<FacetCatalog> {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.catalog;
    }
    // Concurrent requests share one load.
    this.loading ??= this.load().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async load(): Promise<FacetCatalog> {
    const [definitionRows, brands] = await Promise.all([
      this.repository.findFacetDefinitions(),
      this.repository.findActiveBrands(),
    ]);

    const definitions: FacetDefinition[] = definitionRows
      .filter((row): row is typeof row & { key: string } => row.key !== null)
      .map((row) => ({
        id: row.id,
        key: row.key,
        label: row.name,
        displayType: row.displayType,
        options: row.options.map((option) => ({ ...option, swatchHex: option.swatchHex ?? null })),
        optionsBySlug: new Map(row.options.map((option) => [option.slug, { ...option }])),
      }));

    const catalog: FacetCatalog = {
      definitions,
      definitionsByKey: new Map(definitions.map((d) => [d.key, d])),
      brands,
      brandsBySlug: new Map(brands.map((b) => [b.slug, b])),
    };
    this.cached = { catalog, expiresAt: Date.now() + FACET_CATALOG_TTL_MS };
    return catalog;
  }
}
