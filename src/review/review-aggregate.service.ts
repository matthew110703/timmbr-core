import { Injectable } from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface ProductRatingSnapshot {
  ratingAvg: Prisma.Decimal | null;
  ratingCount: number;
  rating1Count: number;
  rating2Count: number;
  rating3Count: number;
  rating4Count: number;
  rating5Count: number;
}

@Injectable()
export class ReviewAggregateService {
  constructor(private readonly prisma: PrismaService) {}

  async refreshProductRatings(
    productId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ProductRatingSnapshot> {
    const client = tx ?? this.prisma;
    const snapshot = await this.computePublishedSnapshot(client, productId);

    await client.product.update({
      where: { id: productId },
      data: snapshot,
    });

    await client.$executeRawUnsafe('SELECT refresh_product_listing(ARRAY[$1::text])', productId);
    return snapshot;
  }

  async computePublishedSnapshot(
    client: Prisma.TransactionClient | PrismaService,
    productId: string,
  ): Promise<ProductRatingSnapshot> {
    const groups = await client.review.groupBy({
      by: ['rating'],
      where: { productId, status: ReviewStatus.PUBLISHED },
      _count: { _all: true },
    });

    const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingCount = 0;
    let sum = 0;

    for (const group of groups) {
      const count = group._count._all;
      ratingCounts[group.rating] = count;
      ratingCount += count;
      sum += group.rating * count;
    }

    const ratingAvg = ratingCount > 0 ? new Prisma.Decimal((sum / ratingCount).toFixed(2)) : null;

    return {
      ratingAvg,
      ratingCount,
      rating1Count: ratingCounts[1] ?? 0,
      rating2Count: ratingCounts[2] ?? 0,
      rating3Count: ratingCounts[3] ?? 0,
      rating4Count: ratingCounts[4] ?? 0,
      rating5Count: ratingCounts[5] ?? 0,
    };
  }
}
