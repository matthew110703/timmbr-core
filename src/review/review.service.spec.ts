jest.mock('./utils/review-sanitize.util', () => ({
  sanitizeReviewComment: (value: string | null | undefined) => value ?? null,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, ReviewStatus } from '@prisma/client';
import { ReviewService } from './review.service';
import { ReviewRepository } from './review.repository';
import { ReviewAggregateService } from './review-aggregate.service';
import { MediaService } from '@/media/media.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ReviewNotEligibleException } from '@/common/exceptions/review.exception';

const mockRepository = {
  findByOrderAndProduct: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
};

const mockAggregate = {
  refreshProductRatings: jest.fn(),
};

const mockMedia = {
  getPublicUrl: jest.fn((k: string) => `https://cdn.example/${k}`),
};

const mockPrisma = {
  order: { findUnique: jest.fn() },
  orderItem: { findFirst: jest.fn() },
  product: { findUnique: jest.fn() },
};

describe('ReviewService', () => {
  let service: ReviewService;

  beforeEach(async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      userId: 'user-1',
      status: OrderStatus.DELIVERED,
    });
    mockPrisma.orderItem.findFirst.mockResolvedValue({ id: 'line-1' });
    mockRepository.findByOrderAndProduct.mockResolvedValue(null);
    mockRepository.create.mockResolvedValue({
      id: 'rev-1',
      userId: 'user-1',
      productId: 'prod-1',
      orderId: 'order-1',
      rating: 5,
      title: null,
      comment: null,
      status: ReviewStatus.PUBLISHED,
      helpfulCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      media: [],
      revisions: [],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: ReviewRepository, useValue: mockRepository },
        { provide: ReviewAggregateService, useValue: mockAggregate },
        { provide: MediaService, useValue: mockMedia },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
  });

  afterEach(() => jest.resetAllMocks());

  it('creates a published review when moderation passes', async () => {
    const result = await service.create('user-1', {
      orderId: 'order-1',
      productId: 'prod-1',
      rating: 5,
    });

    expect(result.status).toBe(ReviewStatus.PUBLISHED);
    expect(mockAggregate.refreshProductRatings).toHaveBeenCalledWith('prod-1');
  });

  it('rejects ineligible orders', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      userId: 'user-1',
      status: OrderStatus.SHIPPED,
    });

    const error = await service
      .create('user-1', { orderId: 'order-1', productId: 'prod-1', rating: 4 })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReviewNotEligibleException);
  });
});
