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
import { BadRequestException } from '@nestjs/common';
import { ReviewNotEligibleException } from '@/common/exceptions/review.exception';

const mockRepository = {
  findByOrderAndProduct: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findByIdLite: jest.fn(),
  findDeliveredOrderOptionsForProduct: jest.fn(),
  findPublishedForProduct: jest.fn(),
  findHelpfulVoteReviewIds: jest.fn(),
  updateStatus: jest.fn(),
  recordModeration: jest.fn(),
  update: jest.fn(),
  deleteRevisionsForReview: jest.fn(),
  findMediaStorageKeys: jest.fn(),
};

const mockAggregate = {
  refreshProductRatings: jest.fn(),
};

const mockMedia = {
  getPublicUrl: jest.fn((k: string) => `https://cdn.example/${k}`),
  delete: jest.fn(),
};

const mockPrisma = {
  order: { findUnique: jest.fn() },
  orderItem: { findFirst: jest.fn() },
  product: { findUnique: jest.fn() },
  review: { update: jest.fn(), delete: jest.fn() },
  reviewModerationEvent: { create: jest.fn() },
  reviewHelpfulVote: { create: jest.fn(), delete: jest.fn() },
  $transaction: jest.fn(),
};

function reviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rev-1',
    userId: 'author-1',
    productId: 'prod-1',
    orderId: 'order-1',
    rating: 4,
    title: 'Live title',
    comment: '<p>Live</p>',
    status: ReviewStatus.PUBLISHED,
    helpfulCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    media: [],
    revisions: [],
    user: { id: 'author-1', name: 'Priya Sharma' },
    product: { id: 'prod-1', title: 'Teak Chair', slug: 'teak-chair', images: [] },
    ...overrides,
  };
}

describe('ReviewService', () => {
  let service: ReviewService;

  beforeEach(async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      userId: 'user-1',
      status: OrderStatus.DELIVERED,
    });
    mockPrisma.orderItem.findFirst.mockResolvedValue({ id: 'line-1' });
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma),
    );
    mockMedia.getPublicUrl.mockImplementation((k: string) => `https://cdn.example/${k}`);
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

  it('returns delivered order options when eligibility omits orderId', async () => {
    mockRepository.findDeliveredOrderOptionsForProduct.mockResolvedValue([
      { orderId: 'order-1', placedAt: new Date('2024-01-01'), existingReviewId: null },
      { orderId: 'order-2', placedAt: new Date('2024-02-01'), existingReviewId: 'rev-old' },
    ]);

    const result = await service.getEligibility('user-1', { productId: 'prod-1' });

    expect(result.eligible).toBe(true);
    expect(result.orders).toHaveLength(2);
    expect(result.orderId).toBeUndefined();
  });

  it('requires a reason when rejecting a review', async () => {
    mockRepository.findByIdLite.mockResolvedValue({
      id: 'rev-1',
      status: ReviewStatus.PENDING,
      productId: 'prod-1',
    });

    await expect(
      service.rejectReview('admin-1', 'rev-1', { reason: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('marks votedByViewer on public list rows', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
    mockRepository.findPublishedForProduct.mockResolvedValue([
      [
        {
          id: 'rev-a',
          userId: 'other',
          productId: 'prod-1',
          orderId: 'order-1',
          rating: 5,
          title: null,
          comment: null,
          status: ReviewStatus.PUBLISHED,
          helpfulCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          media: [],
          revisions: [],
          user: { name: 'Alice Example' },
        },
        {
          id: 'rev-b',
          userId: 'other',
          productId: 'prod-1',
          orderId: 'order-2',
          rating: 4,
          title: null,
          comment: null,
          status: ReviewStatus.PUBLISHED,
          helpfulCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          media: [],
          revisions: [],
          user: { name: 'Bob Example' },
        },
      ],
      2,
    ]);
    mockRepository.findHelpfulVoteReviewIds.mockResolvedValue(new Set(['rev-a']));

    const result = await service.listPublicForProduct('prod-1', {}, 'user-1');

    expect(result.data[0].votedByViewer).toBe(true);
    expect(result.data[0].authorName).toBe('Alice E.');
    expect(result.data[0].userId).toBeUndefined();
    expect(result.data[1].votedByViewer).toBe(false);
  });

  it('applies a clean edit and drops the held revision instead of publishing it', async () => {
    const held = { id: 'revn-1', status: 'PENDING', rating: 1, title: 'spam', comment: 'held' };
    mockRepository.findById.mockResolvedValue(reviewRow({ userId: 'user-1', revisions: [held] }));
    mockRepository.update.mockImplementation((_id: string, data: Record<string, unknown>) =>
      Promise.resolve(reviewRow({ userId: 'user-1', ...data })),
    );

    const result = await service.update('user-1', 'rev-1', { rating: 5, title: 'Clean title' });

    expect(mockRepository.deleteRevisionsForReview).toHaveBeenCalledWith('rev-1', 'PENDING');
    expect(mockRepository.update).toHaveBeenCalledWith(
      'rev-1',
      expect.objectContaining({ rating: 5, title: 'Clean title', status: ReviewStatus.PUBLISHED }),
    );
    expect(result.title).toBe('Clean title');
    expect(result.pendingRevision).toBeNull();
  });

  it('returns the public view after a helpful vote', async () => {
    mockRepository.findByIdLite.mockResolvedValue({
      id: 'rev-1',
      userId: 'author-1',
      status: ReviewStatus.PUBLISHED,
    });
    mockRepository.findById.mockResolvedValue(
      reviewRow({
        revisions: [{ id: 'revn-1', rating: 2, title: 'held', comment: 'held', media: [] }],
      }),
    );

    const added = await service.addHelpfulVote('voter-1', 'rev-1');
    expect(added.votedByViewer).toBe(true);
    expect(added.pendingRevision).toBeNull();
    expect(added.userId).toBeUndefined();
    expect(added.authorName).toBe('Priya S.');

    const removed = await service.removeHelpfulVote('voter-1', 'rev-1');
    expect(removed.votedByViewer).toBe(false);
  });

  it('records status and audit event in one transaction and returns relations', async () => {
    mockRepository.findByIdLite.mockResolvedValue({
      id: 'rev-1',
      status: ReviewStatus.PENDING,
      productId: 'prod-1',
    });
    mockRepository.findById.mockResolvedValue(reviewRow());

    const result = await service.approveReview('admin-1', 'rev-1', {});

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.review.update).toHaveBeenCalledWith({
      where: { id: 'rev-1' },
      data: { status: ReviewStatus.PUBLISHED },
    });
    expect(mockPrisma.reviewModerationEvent.create).toHaveBeenCalled();
    expect(mockAggregate.refreshProductRatings).toHaveBeenCalledWith('prod-1', mockPrisma);
    expect(result.product?.title).toBe('Teak Chair');
    expect(result.reviewer?.name).toBe('Priya Sharma');
  });

  it('deletes an owned review and its stored media', async () => {
    mockRepository.findById.mockResolvedValue(reviewRow({ userId: 'user-1' }));
    mockRepository.findMediaStorageKeys.mockResolvedValue(['a.jpg', 'a-thumb.jpg']);

    await expect(service.remove('user-1', 'rev-1')).resolves.toEqual({ deleted: true });

    expect(mockPrisma.review.delete).toHaveBeenCalledWith({ where: { id: 'rev-1' } });
    expect(mockAggregate.refreshProductRatings).toHaveBeenCalledWith('prod-1', mockPrisma);
    expect(mockMedia.delete).toHaveBeenCalledWith('a.jpg');
    expect(mockMedia.delete).toHaveBeenCalledWith('a-thumb.jpg');
  });
});
