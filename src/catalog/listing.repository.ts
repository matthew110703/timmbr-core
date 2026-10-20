import { Injectable } from '@nestjs/common';
import { BrandStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  listingAggregateQuery,
  listingPageQuery,
  searchSuggestQuery,
} from './listing/listing-query.builder';
import { AggregateRow, ListingCriteria, ListingRow } from './listing/listing.types';

@Injectable()
export class ListingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The page of cards and the aggregates, as two statements in parallel. */
  async findPageAndAggregates(criteria: ListingCriteria): Promise<[ListingRow[], AggregateRow[]]> {
    return Promise.all([
      this.prisma.$queryRaw<ListingRow[]>(listingPageQuery(criteria)),
      this.prisma.$queryRaw<AggregateRow[]>(listingAggregateQuery(criteria)),
    ]);
  }

  async findAggregates(criteria: ListingCriteria): Promise<AggregateRow[]> {
    return this.prisma.$queryRaw<AggregateRow[]>(listingAggregateQuery(criteria));
  }

  /** Typeahead matches for a normalised search query. */
  async findSuggestions(q: string, limit: number): Promise<ListingRow[]> {
    return this.prisma.$queryRaw<ListingRow[]>(searchSuggestQuery(q, limit));
  }

  /** Filterable global attributes with their options, in panel order. */
  async findFacetDefinitions() {
    return this.prisma.attributeDefinition.findMany({
      where: { isFilterable: true, productId: null, key: { not: null }, options: { some: {} } },
      select: {
        id: true,
        key: true,
        name: true,
        displayType: true,
        options: {
          select: { id: true, code: true, slug: true, label: true, swatchHex: true },
          orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
        },
      },
      orderBy: [{ filterOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findActiveBrands() {
    return this.prisma.brand.findMany({
      where: { status: BrandStatus.ACTIVE },
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
