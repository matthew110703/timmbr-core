import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { OutboxEventStatus } from '@prisma/client';
import {
  GENERATE_INVOICE_PDF_JOB,
  INVOICE_PDF_QUEUE,
  OUTBOX_EVENT_INVOICE_PDF_GENERATE,
} from '../queue/invoice.queue.constants';
import { OutboxDispatcherService } from './outbox-dispatcher.service';

describe('OutboxDispatcherService', () => {
  let service: OutboxDispatcherService;
  let mockPrisma: any;
  let mockQueue: { add: jest.Mock };

  beforeEach(async () => {
    mockPrisma = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValue([]),
      outboxEvent: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxDispatcherService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(INVOICE_PDF_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<OutboxDispatcherService>(OutboxDispatcherService);
  });

  afterEach(() => {
    service.stopPolling();
  });

  it('transitions exhausted expired-lease PROCESSING events to DEAD_LETTER before claiming', async () => {
    mockPrisma.$executeRaw.mockResolvedValueOnce(2);
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);

    const count = await service.dispatchBatch();

    expect(count).toBe(0);
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('claims due events, publishes to BullMQ with deterministic jobId, and marks PUBLISHED', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      {
        id: 'evt-1',
        aggregateType: 'INVOICE',
        aggregateId: 'inv-100',
        eventType: OUTBOX_EVENT_INVOICE_PDF_GENERATE,
        payload: { invoiceId: 'inv-100', version: 2, force: true },
        status: OutboxEventStatus.PROCESSING,
        attempts: 1,
        maxAttempts: 10,
      },
    ]);

    const published = await service.dispatchBatch();

    expect(published).toBe(1);
    expect(mockQueue.add).toHaveBeenCalledWith(
      GENERATE_INVOICE_PDF_JOB,
      { invoiceId: 'inv-100', version: 2, force: true },
      expect.objectContaining({
        jobId: 'invoice-pdf-inv-100-v2',
      }),
    );
    expect(mockPrisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['evt-1'] } },
      data: expect.objectContaining({
        status: OutboxEventStatus.PUBLISHED,
        publishedAt: expect.any(Date),
        lockedAt: null,
        lockedBy: null,
        leaseExpiresAt: null,
      }),
    });
  });

  it('reschedules event with exponential backoff when Redis/BullMQ fails, and moves to DEAD_LETTER when attempts reach maxAttempts', async () => {
    mockQueue.add
      .mockRejectedValueOnce(new Error('Redis connection refused'))
      .mockRejectedValueOnce(new Error('Redis still down'));

    mockPrisma.$queryRaw.mockResolvedValueOnce([
      {
        id: 'evt-retry',
        aggregateType: 'INVOICE',
        aggregateId: 'inv-1',
        eventType: OUTBOX_EVENT_INVOICE_PDF_GENERATE,
        payload: { invoiceId: 'inv-1', version: 1 },
        status: OutboxEventStatus.PROCESSING,
        attempts: 2,
        maxAttempts: 5,
      },
      {
        id: 'evt-dead',
        aggregateType: 'INVOICE',
        aggregateId: 'inv-2',
        eventType: OUTBOX_EVENT_INVOICE_PDF_GENERATE,
        payload: { invoiceId: 'inv-2', version: 1 },
        status: OutboxEventStatus.PROCESSING,
        attempts: 5,
        maxAttempts: 5,
      },
    ]);

    const published = await service.dispatchBatch();

    expect(published).toBe(0);
    expect(mockPrisma.outboxEvent.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'evt-retry' },
        data: expect.objectContaining({
          status: OutboxEventStatus.PENDING,
          lastError: 'Redis connection refused',
          nextAttemptAt: expect.any(Date),
        }),
      }),
    );
    expect(mockPrisma.outboxEvent.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'evt-dead' },
        data: expect.objectContaining({
          status: OutboxEventStatus.DEAD_LETTER,
          lastError: 'Redis still down',
        }),
      }),
    );
  });
});
