import { ReviewAggregateService } from './review-aggregate.service';
import { ReviewStatus } from '@prisma/client';

const mockPrisma = {
  review: { groupBy: jest.fn() },
  product: { update: jest.fn() },
  $executeRawUnsafe: jest.fn(),
};

describe('ReviewAggregateService', () => {
  let service: ReviewAggregateService;

  beforeEach(() => {
    mockPrisma.review.groupBy.mockResolvedValue([
      { rating: 5, _count: { _all: 1 } },
      { rating: 3, _count: { _all: 1 } },
    ]);
    mockPrisma.product.update.mockResolvedValue({});
    mockPrisma.$executeRawUnsafe.mockResolvedValue(1);
    service = new ReviewAggregateService(mockPrisma as never);
    jest.clearAllMocks();
  });

  afterEach(() => jest.resetAllMocks());

  it('recomputes aggregates with groupBy without loading all rows', async () => {
    await service.refreshProductRatings('product-1');

    expect(mockPrisma.review.groupBy).toHaveBeenCalledWith({
      by: ['rating'],
      where: { productId: 'product-1', status: ReviewStatus.PUBLISHED },
      _count: { _all: true },
    });
    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'product-1' },
        data: expect.objectContaining({
          ratingCount: 2,
          rating5Count: 1,
          rating3Count: 1,
        }),
      }),
    );
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalled();
  });

  it('computePublishedSnapshot matches groupBy totals', async () => {
    const snapshot = await service.computePublishedSnapshot(mockPrisma as never, 'product-1');
    expect(snapshot.ratingCount).toBe(2);
    expect(snapshot.rating5Count).toBe(1);
    expect(snapshot.rating3Count).toBe(1);
    expect(snapshot.ratingAvg).not.toBeNull();
  });
});
